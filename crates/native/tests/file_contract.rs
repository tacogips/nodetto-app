use nodetto_native::{
    attachments,
    fs::{write_atomic, write_selected_file_atomic},
};
use std::{fs, io, path::Path};

type Writer = fn(&Path, &[u8]) -> io::Result<()>;

#[test]
fn both_access_modes_replace_bytes_and_leave_no_partial_files() {
    let writers: [Writer; 2] = [
        |p, b| write_atomic(p, b),
        |p, b| write_selected_file_atomic(p, b),
    ];
    for write in writers {
        let folder = tempfile::tempdir().unwrap();
        let file = folder.path().join("doc.jsonl");
        write(&file, b"before").unwrap();
        write(&file, &[0, 128, 255, 10]).unwrap();
        assert_eq!(fs::read(&file).unwrap(), [0, 128, 255, 10]);
        assert_eq!(fs::read_dir(folder.path()).unwrap().count(), 1);
        assert!(write(&folder.path().join("missing/doc"), b"no").is_err());
        assert!(!folder.path().join("missing").exists());
        assert!(write(folder.path(), b"no").is_err());
        assert_eq!(fs::read(&file).unwrap(), [0, 128, 255, 10]);
        assert_eq!(fs::read_dir(folder.path()).unwrap().count(), 1);
    }
}

#[cfg(unix)]
#[test]
fn directory_access_preserves_modes_and_symbolic_links() {
    use std::os::unix::fs::{symlink, PermissionsExt};
    let folder = tempfile::tempdir().unwrap();
    let target = folder.path().join("target");
    fs::write(&target, b"before").unwrap();
    fs::set_permissions(&target, fs::Permissions::from_mode(0o640)).unwrap();
    let link = folder.path().join("link");
    symlink("target", &link).unwrap();
    write_atomic(&link, b"after").unwrap();
    assert!(fs::symlink_metadata(&link)
        .unwrap()
        .file_type()
        .is_symlink());
    assert_eq!(fs::read(&target).unwrap(), b"after");
    assert_eq!(
        fs::metadata(&target).unwrap().permissions().mode() & 0o777,
        0o640
    );
    let dangling = folder.path().join("dangling");
    symlink("new", &dangling).unwrap();
    write_atomic(&dangling, b"created").unwrap();
    assert_eq!(fs::read(folder.path().join("new")).unwrap(), b"created");
    symlink("cycle", folder.path().join("cycle")).unwrap();
    assert!(write_atomic(folder.path().join("cycle"), b"no").is_err());
}

#[test]
fn portable_attachment_paths_match_browser_contract_and_utf8_limits() {
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("../../../test-fixtures/attachment-paths.json")).unwrap();
    for value in cases["valid"].as_array().unwrap() {
        assert!(attachments::relative_path(value.as_str().unwrap()).is_ok());
    }
    for value in cases["invalid"].as_array().unwrap() {
        assert!(attachments::relative_path(value.as_str().unwrap()).is_err());
    }
    assert!(attachments::relative_path(&"a".repeat(1024)).is_ok());
    assert!(attachments::relative_path(&"a".repeat(1025)).is_err());
    assert!(attachments::relative_path(&"図".repeat(341)).is_ok());
    assert!(attachments::relative_path(&"図".repeat(342)).is_err());
}

#[test]
fn attachments_are_document_relative_bounded_and_regular_files() {
    let folder = tempfile::tempdir().unwrap();
    let document = folder.path().join("unsaved.jsonl");
    fs::create_dir(folder.path().join("assets")).unwrap();
    let image = folder.path().join("assets/image.png");
    fs::write(&image, [0, 128, 255]).unwrap();
    assert_eq!(
        attachments::read(&document, "assets/image.png").unwrap(),
        [0, 128, 255]
    );
    assert!(attachments::read(&document, "assets").is_err());
    let file = fs::OpenOptions::new().write(true).open(&image).unwrap();
    file.set_len(attachments::MAX_ATTACHMENT_BYTES).unwrap();
    assert_eq!(
        attachments::read(&document, "assets/image.png")
            .unwrap()
            .len() as u64,
        attachments::MAX_ATTACHMENT_BYTES
    );
    file.set_len(attachments::MAX_ATTACHMENT_BYTES + 1).unwrap();
    assert_eq!(
        attachments::read(&document, "assets/image.png")
            .unwrap_err()
            .kind(),
        io::ErrorKind::InvalidData
    );
    #[cfg(unix)]
    {
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("private"), b"no").unwrap();
        std::os::unix::fs::symlink(outside.path(), folder.path().join("escape")).unwrap();
        assert!(attachments::read(&document, "escape/private").is_err());
    }
}

#[test]
fn capture_writes_exclusively_and_only_replaces_regular_files() {
    use nodetto_native::fs::{replace_regular, write_new, NewFile};

    let folder = tempfile::tempdir().unwrap();
    let image = folder.path().join("image.png");
    let before = [0, 128, 255];
    let after = [0, 129, 255];

    assert_eq!(write_new(&image, &before).unwrap(), NewFile::Written);
    assert_eq!(fs::read(&image).unwrap(), before);
    assert_eq!(write_new(&image, &before).unwrap(), NewFile::Identical);
    assert_eq!(write_new(&image, &after).unwrap(), NewFile::Exists);
    assert_eq!(write_new(&image, b"shorter data").unwrap(), NewFile::Exists);
    assert_eq!(fs::read(&image).unwrap(), before);
    assert_eq!(write_new(folder.path(), b"").unwrap(), NewFile::Exists);
    assert!(replace_regular(folder.path(), b"").is_err());

    replace_regular(&image, &after).unwrap();
    assert_eq!(fs::read(&image).unwrap(), after);
    let missing = folder.path().join("new.png");
    replace_regular(&missing, &before).unwrap();
    assert_eq!(fs::read(&missing).unwrap(), before);
}

#[cfg(unix)]
#[test]
fn capture_writes_refuse_links_and_unwritable_destinations() {
    use nodetto_native::fs::{current_owner, replace_regular, write_new, NewFile};
    use std::os::unix::fs::{symlink, PermissionsExt};

    let folder = tempfile::tempdir().unwrap();
    let target = folder.path().join("target.png");
    let missing = folder.path().join("missing.png");
    fs::write(&target, b"original").unwrap();
    for (name, destination) in [("link.png", &target), ("dangling.png", &missing)] {
        let link = folder.path().join(name);
        symlink(destination, &link).unwrap();
        assert_eq!(write_new(&link, b"original").unwrap(), NewFile::Exists);
        let error = replace_regular(&link, b"changed").unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
        assert_eq!(error.to_string(), "the output path is a symbolic link");
        assert_eq!(fs::read_link(&link).unwrap(), *destination);
    }
    assert_eq!(fs::read(&target).unwrap(), b"original");
    assert!(!missing.exists());

    // An effective uid of zero can bypass directory mode bits.
    if current_owner(folder.path()).unwrap() != Some(0) {
        let readonly = folder.path().join("readonly");
        fs::create_dir(&readonly).unwrap();
        fs::set_permissions(&readonly, fs::Permissions::from_mode(0o500)).unwrap();
        let image = readonly.join("image.png");
        let result = write_new(&image, b"capture");
        fs::set_permissions(&readonly, fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(result.unwrap_err().kind(), io::ErrorKind::PermissionDenied);
        assert_eq!(fs::read_dir(&readonly).unwrap().count(), 0);
    }
}

#[test]
fn private_capture_directory_requires_a_real_directory() {
    use nodetto_native::fs::{current_owner, private_dir};

    let folder = tempfile::tempdir().unwrap();
    let owner = current_owner(folder.path()).unwrap();
    let directory = folder.path().join("captures");
    private_dir(&directory, owner).unwrap();
    private_dir(&directory, owner).unwrap();
    let file = folder.path().join("file");
    fs::write(&file, b"ordinary file").unwrap();
    assert_eq!(
        private_dir(&file, owner).unwrap_err().to_string(),
        "it is not a directory",
    );

    #[cfg(unix)]
    {
        use std::os::unix::fs::{symlink, MetadataExt, PermissionsExt};

        let metadata = directory.metadata().unwrap();
        assert_eq!(owner, Some(metadata.uid()));
        assert_eq!(metadata.mode() & 0o777, 0o700);
        let link = folder.path().join("link");
        symlink(&directory, &link).unwrap();
        assert_eq!(
            private_dir(&link, owner).unwrap_err().to_string(),
            "it is not a directory",
        );
        assert_eq!(
            private_dir(&directory, Some(metadata.uid() ^ 1))
                .unwrap_err()
                .to_string(),
            "it belongs to another user",
        );
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o777)).unwrap();
        assert_eq!(
            private_dir(&directory, owner).unwrap_err().to_string(),
            "it is writable by other users",
        );
    }
}
