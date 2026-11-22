use std::{
    fs,
    io::{self, Read, Write},
    path::Path,
};

#[derive(Debug, PartialEq, Eq)]
pub enum NewFile {
    Written,
    Identical,
    Exists,
}

/// Create a file exclusively. Compare an existing regular file without
/// opening a link or overwriting anything.
pub fn write_new(path: impl AsRef<Path>, bytes: &[u8]) -> io::Result<NewFile> {
    write_new_with(path.as_ref(), bytes, |file| file.write_all(bytes))
}

fn write_new_with(
    path: &Path,
    bytes: &[u8],
    write_contents: impl FnOnce(&mut fs::File) -> io::Result<()>,
) -> io::Result<NewFile> {
    let mut file = match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
    {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            return Ok(if existing_matches(path, bytes).unwrap_or(false) {
                NewFile::Identical
            } else {
                NewFile::Exists
            });
        }
        Err(error) => return Err(error),
    };
    let result = write_contents(&mut file).and_then(|()| file.sync_all());
    drop(file);
    if let Err(error) = result {
        let _ = fs::remove_file(path);
        return Err(error);
    }
    Ok(NewFile::Written)
}

fn existing_matches(path: &Path, bytes: &[u8]) -> io::Result<bool> {
    let size = bytes.len() as u64;
    let metadata = path.symlink_metadata()?;
    if !metadata.is_file() || metadata.len() != size {
        return Ok(false);
    }

    let mut options = fs::OpenOptions::new();
    options.read(true);
    // O_NOFOLLOW rejects a link swapped in after the metadata check.
    // O_NONBLOCK keeps a swapped-in named pipe from blocking the open.
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(0x100 | 0x4);
    }
    #[cfg(all(
        target_os = "linux",
        any(target_arch = "x86_64", target_arch = "aarch64")
    ))]
    {
        use std::os::unix::fs::OpenOptionsExt;
        #[cfg(target_arch = "x86_64")]
        options.custom_flags(0x20000 | 0x800);
        #[cfg(target_arch = "aarch64")]
        options.custom_flags(0x8000 | 0x800);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // FILE_FLAG_OPEN_REPARSE_POINT
        options.custom_flags(0x00200000);
    }
    let file = options.open(path)?;
    let opened = file.metadata()?;
    if !opened.is_file() || opened.len() != size {
        return Ok(false);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if opened.dev() != metadata.dev() || opened.ino() != metadata.ino() {
            return Ok(false);
        }
    }
    let mut contents = Vec::new();
    file.take(size + 1).read_to_end(&mut contents)?;
    Ok(contents == bytes)
}

/// Atomically replace a regular file, or create the target exclusively.
pub fn replace_regular(path: impl AsRef<Path>, bytes: &[u8]) -> io::Result<()> {
    let path = path.as_ref();
    match path.symlink_metadata() {
        Ok(metadata) if metadata.is_file() => {
            write_to_entry(path, bytes, Some(metadata.permissions()))
        }
        Ok(metadata) if metadata.is_symlink() => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "the output path is a symbolic link",
        )),
        Ok(_) => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "the output path is not a regular file",
        )),
        Err(error) if error.kind() == io::ErrorKind::NotFound => match write_new(path, bytes)? {
            NewFile::Written | NewFile::Identical => Ok(()),
            NewFile::Exists => Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "the output path appeared while writing",
            )),
        },
        Err(error) => Err(error),
    }
}

/// Create or validate a capture directory without accepting a symbolic link.
pub fn private_dir(path: impl AsRef<Path>, owner: Option<u32>) -> io::Result<()> {
    let path = path.as_ref();
    let mut builder = fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    match builder.create(path) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
        Err(error) => return Err(error),
    }
    let metadata = path.symlink_metadata()?;
    if !metadata.is_dir() {
        return Err(io::Error::other("it is not a directory"));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if owner != Some(metadata.uid()) {
            return Err(io::Error::other("it belongs to another user"));
        }
        if metadata.mode() & 0o022 != 0 {
            return Err(io::Error::other("it is writable by other users"));
        }
    }
    #[cfg(not(unix))]
    let _ = owner;
    Ok(())
}

/// Determine the effective owner through an anonymous temporary file.
pub fn current_owner(dir: impl AsRef<Path>) -> io::Result<Option<u32>> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Ok(Some(tempfile::tempfile_in(dir)?.metadata()?.uid()))
    }
    #[cfg(not(unix))]
    {
        let _ = dir;
        Ok(None)
    }
}

/// A sibling temp file, fsync and rename preserve a user's file on failure.
/// Resolve links (including dangling links) without replacing the links.
pub fn write_atomic(path: impl AsRef<Path>, bytes: &[u8]) -> io::Result<()> {
    write_with_permissions(path.as_ref(), bytes, None)
}

pub(crate) fn write_with_permissions(
    original: &Path,
    bytes: &[u8],
    permissions: Option<fs::Permissions>,
) -> io::Result<()> {
    let mut target = original.to_path_buf();
    let mut resolved = false;
    for _ in 0..40 {
        match fs::symlink_metadata(&target) {
            Ok(meta) if meta.file_type().is_symlink() => {
                let link = fs::read_link(&target)?;
                target = target.parent().unwrap_or(Path::new(".")).join(link);
            }
            _ => {
                resolved = true;
                break;
            }
        }
    }
    if !resolved {
        return Err(io::Error::other("Too many symbolic links"));
    }
    let permissions = permissions.or_else(|| fs::metadata(&target).ok().map(|m| m.permissions()));
    write_to_entry(&target, bytes, permissions)
}

fn write_to_entry(
    target: &Path,
    bytes: &[u8],
    permissions: Option<fs::Permissions>,
) -> io::Result<()> {
    let parent = target
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut builder = tempfile::Builder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        builder.permissions(fs::Permissions::from_mode(0o666));
    }
    let mut temporary = builder.tempfile_in(parent)?;
    if let Some(permissions) = permissions {
        temporary.as_file().set_permissions(permissions)?;
    }
    temporary.write_all(bytes)?;
    temporary.as_file().sync_all()?;
    temporary.persist(target).map_err(|error| error.error)?;
    if let Ok(directory) = fs::File::open(parent) {
        let _ = directory.sync_all();
    }
    Ok(())
}

// Foundation's atomic writer uses the system's replacement-file mechanism.
// A sandbox grant for an individual document does not permit us to create
// an arbitrary sibling in its parent directory.
#[cfg(target_os = "macos")]
pub fn write_selected_file_atomic(path: impl AsRef<Path>, contents: &[u8]) -> io::Result<()> {
    use objc2_foundation::{NSData, NSDataWritingOptions, NSString, NSURL};

    let path = path.as_ref().to_str().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "file path is not valid UTF-8")
    })?;
    let url = NSURL::fileURLWithPath(&NSString::from_str(path));
    NSData::with_bytes(contents)
        .writeToURL_options_error(&url, NSDataWritingOptions::Atomic)
        .map_err(|error| io::Error::other(error.to_string()))
}

#[cfg(not(target_os = "macos"))]
pub use write_atomic as write_selected_file_atomic;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_new_removes_a_partly_written_file_on_error() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("image.png");
        let error = write_new_with(&path, b"capture", |file| {
            file.write_all(b"cap")?;
            assert_eq!(file.metadata()?.len(), 3);
            Err(io::Error::other("injected write failure"))
        })
        .unwrap_err();

        assert_eq!(error.to_string(), "injected write failure");
        assert_eq!(
            path.symlink_metadata().unwrap_err().kind(),
            io::ErrorKind::NotFound
        );
    }
}
