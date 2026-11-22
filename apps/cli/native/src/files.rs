use std::{
    fs, io,
    path::PathBuf,
    process::{Command, Stdio},
};

use nodetto_native::fs::{current_owner, private_dir, replace_regular, write_new, NewFile};
pub use nodetto_native::{attachments::read as attachment, fs::write_atomic};

pub fn capture_dir() -> io::Result<PathBuf> {
    let parent = std::env::temp_dir();
    let cannot_use = |path: &std::path::Path, error: io::Error| {
        io::Error::new(
            error.kind(),
            format!(
                "Cannot use the capture directory {}: {error}.",
                path.display()
            ),
        )
    };
    let owner = current_owner(&parent).map_err(|error| cannot_use(&parent, error))?;
    let directory = parent.join(match owner {
        Some(uid) => format!("nodetto-capture-{uid}"),
        None => "nodetto-capture".to_owned(),
    });
    private_dir(&directory, owner).map_err(|error| cannot_use(&directory, error))?;
    Ok(directory)
}

pub fn write_capture(path: &str, bytes: &[u8], replace: bool) -> io::Result<&'static str> {
    if replace {
        replace_regular(path, bytes)?;
        return Ok("written");
    }
    Ok(match write_new(path, bytes)? {
        NewFile::Written => "written",
        NewFile::Identical => "identical",
        NewFile::Exists => "exists",
    })
}

pub fn digest(bytes: &[u8]) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for &byte in bytes {
        hash = (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn list_dir(path: &str) -> io::Result<Vec<String>> {
    let mut names = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            if let Ok(name) = entry.file_name().into_string() {
                names.push(name);
            }
        }
    }
    names.sort();
    Ok(names)
}

/// `link` is a nodetto:// link for the same file that selects a page; the
/// file still goes first so a sandboxed macOS app is granted access to it.
pub fn open_document(path: &str, app: Option<String>, link: Option<String>) -> io::Result<()> {
    if !fs::metadata(path)?.is_file() {
        return Err(io::Error::other("The path must be a regular file."));
    }
    let absolute = std::path::absolute(PathBuf::from(path))?;
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/usr/bin/open")
            .args(["-a", app.as_deref().unwrap_or("nodetto"), "--"])
            .arg(absolute)
            .args(link)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()?;
        if !status.success() {
            return Err(io::Error::other(format!(
                "macOS could not open the app (exit {}). Use --app to specify its name or path.",
                status.code().unwrap_or(-1)
            )));
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Command::new(app.unwrap_or_else(|| {
            if cfg!(windows) {
                "nodetto.exe"
            } else {
                "nodetto"
            }
            .into()
        }))
        .arg(absolute)
        .args(link)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    }
    Ok(())
}
