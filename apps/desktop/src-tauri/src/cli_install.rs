// Installs the bundled nodetto-cli for terminal use.
//
// The macOS app carries the native CLI next to its main executable. Installing
// links `~/.local/bin/nodetto-cli` to that copy, so updating the app updates
// the command, and adds `~/.local/bin` to the login shell's PATH when it is
// missing. Any nodetto-cli the login shell already finds on PATH (Homebrew,
// an earlier install) blocks the install, so two copies never compete on PATH
// order. Uninstalling removes only the link: other tools also live in
// `~/.local/bin`, so the PATH lines stay.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::Serialize;

const COMMAND: &str = "nodetto-cli";
const BLOCK_BEGIN: &str = "# >>> Nodetto CLI >>>";
const BLOCK_END: &str = "# <<< Nodetto CLI <<<";
const POSIX_PATH_LINE: &str = "export PATH=\"$HOME/.local/bin:$PATH\"";
const FISH_PATH_LINE: &str = "fish_add_path --path \"$HOME/.local/bin\"";
const FISH_FILE_HEADER: &str = "# Added by Nodetto so that nodetto-cli is on PATH.";
const PATH_BEGIN: &str = "__NODETTO_PATH_BEGIN__";
const PATH_END: &str = "__NODETTO_PATH_END__";
const SHELL_TIMEOUT: Duration = Duration::from_secs(5);
/// A link counts as Nodetto's when it points at a CLI inside an app bundle.
const BUNDLED_SUFFIX: &str = ".app/Contents/MacOS/nodetto-cli";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShellKind {
    Zsh,
    Bash,
    Fish,
    Other,
}

impl ShellKind {
    fn from_program(program: &Path) -> Self {
        match program.file_name().and_then(|name| name.to_str()) {
            Some("zsh") => Self::Zsh,
            Some("bash") => Self::Bash,
            Some("fish") => Self::Fish,
            _ => Self::Other,
        }
    }
}

/// Host facts the decisions depend on. Gathered once per request so the
/// decisions themselves are pure and testable against a temporary home.
#[derive(Clone, Debug)]
pub struct Environment {
    pub home: PathBuf,
    pub shell: ShellKind,
    /// The login shell's PATH, or a best-effort fallback when it is unreadable.
    pub path: Vec<PathBuf>,
    /// The CLI inside the running app bundle, when it exists.
    pub bundled: Option<PathBuf>,
    pub sandboxed: bool,
    pub macos: bool,
}

/// A startup-file change that puts `~/.local/bin` on PATH.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathChange {
    pub file: String,
    pub line: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(
    tag = "state",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum CliStatus {
    /// Installing is not possible here; `reason` says why.
    Unavailable { reason: String },
    /// The login shell already finds a nodetto-cli. `managed` is true when it
    /// is the link this app created, which can then be uninstalled.
    OnPath {
        path: String,
        resolved: Option<String>,
        managed: bool,
    },
    /// Installing would create `link` pointing at `target` and, when
    /// `path_change` is set, add that line to that file. `managed_link` is
    /// true when a link from an earlier install exists but is not on PATH.
    Ready {
        link: String,
        target: String,
        path_change: Option<PathChange>,
        managed_link: bool,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub status: CliStatus,
    /// The command that puts the CLI on PATH in an already open terminal.
    pub current_terminal: Option<String>,
}

fn display(path: &Path) -> String {
    path.display().to_string()
}

fn bin_dir(home: &Path) -> PathBuf {
    home.join(".local").join("bin")
}

fn link_path(home: &Path) -> PathBuf {
    bin_dir(home).join(COMMAND)
}

/// The startup file that receives the PATH line, following the split
/// Homebrew documents for macOS login shells.
fn path_change(env: &Environment) -> PathChange {
    let (file, line) = match env.shell {
        ShellKind::Zsh => (env.home.join(".zprofile"), POSIX_PATH_LINE),
        ShellKind::Bash => (env.home.join(".bash_profile"), POSIX_PATH_LINE),
        ShellKind::Fish => (
            env.home
                .join(".config")
                .join("fish")
                .join("conf.d")
                .join("nodetto.fish"),
            FISH_PATH_LINE,
        ),
        ShellKind::Other => (env.home.join(".profile"), POSIX_PATH_LINE),
    };
    PathChange {
        file: display(&file),
        line: line.to_string(),
    }
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path)
            .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

/// The first nodetto-cli on `path`, as the shell would pick it.
fn find_on_path(path: &[PathBuf]) -> Option<PathBuf> {
    path.iter()
        .map(|directory| directory.join(COMMAND))
        .find(|candidate| is_executable(candidate))
}

/// True when `path` is a symlink this app created, even if it now dangles
/// because the app moved.
fn is_managed_link(path: &Path) -> bool {
    fs::read_link(path)
        .map(|target| display(&target).ends_with(BUNDLED_SUFFIX))
        .unwrap_or(false)
}

fn runs_from_temporary_location(bundled: &Path) -> bool {
    let text = display(bundled);
    text.starts_with("/Volumes/") || text.contains("/AppTranslocation/")
}

pub fn status(env: &Environment) -> CliStatus {
    if env.sandboxed {
        return CliStatus::Unavailable {
            reason: "The App Store version cannot install commands outside its sandbox. Run the nodetto-cli inside the app by its full path instead.".into(),
        };
    }
    if let Some(found) = find_on_path(&env.path) {
        return CliStatus::OnPath {
            resolved: fs::canonicalize(&found).ok().map(|path| display(&path)),
            managed: found == link_path(&env.home) && is_managed_link(&found),
            path: display(&found),
        };
    }
    if !env.macos {
        return CliStatus::Unavailable {
            reason: "Installing nodetto-cli from Settings is available in the macOS app.".into(),
        };
    }
    let Some(bundled) = env.bundled.as_ref() else {
        return CliStatus::Unavailable {
            reason: "This build of Nodetto does not include nodetto-cli.".into(),
        };
    };
    if runs_from_temporary_location(bundled) {
        return CliStatus::Unavailable {
            reason: "Move Nodetto to the Applications folder and open it from there first, so the command keeps working after the disk image is ejected.".into(),
        };
    }
    let link = link_path(&env.home);
    let managed_link = is_managed_link(&link);
    if !managed_link && fs::symlink_metadata(&link).is_ok() {
        return CliStatus::Unavailable {
            reason: format!(
                "{} already exists and was not created by Nodetto. Remove or rename it to install.",
                display(&link)
            ),
        };
    }
    let on_path = env
        .path
        .iter()
        .any(|directory| directory == &bin_dir(&env.home));
    CliStatus::Ready {
        link: display(&link),
        target: display(bundled),
        path_change: (!on_path).then(|| path_change(env)),
        managed_link,
    }
}

/// Insert or refresh the marked PATH block. Returns `None` when `text`
/// already holds exactly this block.
fn upsert_block(text: &str, line: &str) -> Option<String> {
    let block = format!("{BLOCK_BEGIN}\n{line}\n{BLOCK_END}\n");
    if let Some(begin) = text.find(BLOCK_BEGIN) {
        if let Some(end_offset) = text[begin..].find(BLOCK_END) {
            let mut end = begin + end_offset + BLOCK_END.len();
            if text[end..].starts_with('\n') {
                end += 1;
            }
            if text[begin..end] == block {
                return None;
            }
            return Some(format!("{}{block}{}", &text[..begin], &text[end..]));
        }
    }
    let separator = match text {
        "" => "",
        _ if text.ends_with("\n\n") => "",
        _ if text.ends_with('\n') => "\n",
        _ => "\n\n",
    };
    Some(format!("{text}{separator}{block}"))
}

/// Write through symlinked dotfiles instead of replacing the link.
fn write_profile(file: &Path, text: &str) -> io::Result<()> {
    let target = fs::canonicalize(file).unwrap_or_else(|_| file.to_path_buf());
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    crate::fs::write_atomic(&target, text)
}

fn apply_path_change(shell: ShellKind, change: &PathChange) -> io::Result<()> {
    let file = Path::new(&change.file);
    if shell == ShellKind::Fish {
        let text = format!("{FISH_FILE_HEADER}\n{}\n", change.line);
        if fs::read_to_string(file).ok().as_deref() == Some(text.as_str()) {
            return Ok(());
        }
        return write_profile(file, &text);
    }
    let existing = match fs::read_to_string(file) {
        Ok(text) => text,
        Err(error) if error.kind() == io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(error),
    };
    match upsert_block(&existing, &change.line) {
        Some(text) => write_profile(file, &text),
        None => Ok(()),
    }
}

/// Point `link` at `target`, replacing an earlier link in one rename.
fn replace_link(target: &Path, link: &Path) -> io::Result<()> {
    let directory = link
        .parent()
        .ok_or_else(|| io::Error::other("the link has no parent directory"))?;
    fs::create_dir_all(directory)?;
    let temporary = directory.join(format!(".{COMMAND}.{}.tmp", std::process::id()));
    let _ = fs::remove_file(&temporary);
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, &temporary)?;
    #[cfg(not(unix))]
    return Err(io::Error::other("symbolic links are not supported here"));
    fs::rename(&temporary, link).inspect_err(|_| {
        let _ = fs::remove_file(&temporary);
    })
}

/// Install after re-checking the status. The returned hint is set when the
/// PATH change only reaches terminals opened from now on.
pub fn install(env: &Environment) -> Result<Option<String>, String> {
    match status(env) {
        CliStatus::Ready {
            link,
            target,
            path_change,
            ..
        } => {
            replace_link(Path::new(&target), Path::new(&link))
                .map_err(|error| format!("failed to create {link}: {error}"))?;
            let Some(change) = path_change else {
                return Ok(None);
            };
            apply_path_change(env.shell, &change)
                .map_err(|error| format!("failed to update {}: {error}", change.file))?;
            Ok(Some(match env.shell {
                ShellKind::Fish => change.line,
                _ => POSIX_PATH_LINE.to_string(),
            }))
        }
        CliStatus::OnPath { path, .. } => Err(format!("nodetto-cli is already on PATH at {path}.")),
        CliStatus::Unavailable { reason } => Err(reason),
    }
}

/// Remove the link this app created. Anything else is left alone.
pub fn uninstall(env: &Environment) -> Result<(), String> {
    let link = link_path(&env.home);
    if !is_managed_link(&link) {
        return Err(format!(
            "{} is not a link created by Nodetto.",
            display(&link)
        ));
    }
    fs::remove_file(&link).map_err(|error| format!("failed to remove {}: {error}", display(&link)))
}

fn login_shell() -> PathBuf {
    if let Some(shell) = std::env::var_os("SHELL").filter(|shell| !shell.is_empty()) {
        return PathBuf::from(shell);
    }
    // Apps opened from Finder may not inherit SHELL; ask the directory service.
    let user = std::env::var("USER").unwrap_or_default();
    let record = format!("/Users/{user}");
    Command::new("/usr/bin/dscl")
        .args([".", "-read", record.as_str(), "UserShell"])
        .stderr(Stdio::null())
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|text| text.split_whitespace().nth(1).map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("/bin/zsh"))
}

/// The PATH an interactive login shell sees, which is what a new terminal
/// gets. Apps started from the Dock inherit only a minimal PATH.
fn login_shell_path(shell: &Path) -> Option<String> {
    let script = format!("printf '\\n{PATH_BEGIN}%s{PATH_END}\\n' \"$PATH\"");
    let mut child = Command::new(shell)
        .args(["-l", "-i", "-c", script.as_str()])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + SHELL_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(25));
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
    let output = child.wait_with_output().ok()?;
    parse_shell_path(&String::from_utf8_lossy(&output.stdout))
}

fn parse_shell_path(output: &str) -> Option<String> {
    let start = output.find(PATH_BEGIN)? + PATH_BEGIN.len();
    let length = output[start..].find(PATH_END)?;
    Some(output[start..start + length].to_string())
}

fn split_path(path: &str) -> Vec<PathBuf> {
    path.split(':')
        .filter(|entry| !entry.is_empty())
        .map(PathBuf::from)
        .collect()
}

/// Without the login shell's PATH, look where installs usually land.
fn fallback_path(home: &Path) -> Vec<PathBuf> {
    let mut path = std::env::var("PATH")
        .map(|value| split_path(&value))
        .unwrap_or_default();
    for directory in [
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        bin_dir(home),
    ] {
        if !path.contains(&directory) {
            path.push(directory);
        }
    }
    path
}

fn gather() -> Result<Environment, String> {
    let home = std::env::var_os("HOME")
        .filter(|home| !home.is_empty())
        .map(PathBuf::from)
        .ok_or("HOME is not set")?;
    let shell = login_shell();
    let sandboxed = std::env::var_os("APP_SANDBOX_CONTAINER_ID").is_some();
    let path = if sandboxed {
        Vec::new()
    } else {
        login_shell_path(&shell)
            .map(|path| split_path(&path))
            .unwrap_or_else(|| fallback_path(&home))
    };
    let bundled = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|directory| directory.join(COMMAND)))
        .filter(|path| is_executable(path));
    Ok(Environment {
        home,
        shell: ShellKind::from_program(&shell),
        path,
        bundled,
        sandboxed,
        macos: cfg!(target_os = "macos"),
    })
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| format!("the command line installer stopped: {error}"))?
}

#[tauri::command]
pub async fn cli_install_status() -> Result<CliStatus, String> {
    blocking(|| gather().map(|env| status(&env))).await
}

#[tauri::command]
pub async fn cli_install() -> Result<InstallResult, String> {
    blocking(|| {
        let current_terminal = install(&gather()?)?;
        Ok(InstallResult {
            status: status(&gather()?),
            current_terminal,
        })
    })
    .await
}

#[tauri::command]
pub async fn cli_uninstall() -> Result<CliStatus, String> {
    blocking(|| {
        let env = gather()?;
        uninstall(&env)?;
        Ok(status(&gather()?))
    })
    .await
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::{symlink, PermissionsExt};
    use tempfile::{tempdir, TempDir};

    struct Fixture {
        root: TempDir,
        env: Environment,
    }

    impl Fixture {
        fn new(shell: ShellKind) -> Self {
            let root = tempdir().expect("temp dir");
            let home = root.path().join("home");
            fs::create_dir_all(&home).expect("home");
            let bundled = root
                .path()
                .join("Applications/Nodetto.app/Contents/MacOS/nodetto-cli");
            executable(&bundled);
            let env = Environment {
                home,
                shell,
                path: vec![root.path().join("usr/bin")],
                bundled: Some(bundled),
                sandboxed: false,
                macos: true,
            };
            Self { root, env }
        }

        fn with_local_bin_on_path(mut self) -> Self {
            self.env.path.push(bin_dir(&self.env.home));
            self
        }

        fn link(&self) -> PathBuf {
            link_path(&self.env.home)
        }
    }

    fn executable(path: &Path) {
        fs::create_dir_all(path.parent().expect("parent")).expect("dirs");
        fs::write(path, "#!/bin/sh\n").expect("write");
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).expect("chmod");
    }

    fn ready(status: CliStatus) -> (String, String, Option<PathChange>, bool) {
        match status {
            CliStatus::Ready {
                link,
                target,
                path_change,
                managed_link,
            } => (link, target, path_change, managed_link),
            other => panic!("expected Ready, got {other:?}"),
        }
    }

    #[test]
    fn a_cli_already_on_path_blocks_the_install_and_reports_its_path() {
        let fixture = Fixture::new(ShellKind::Zsh);
        let brew = fixture.root.path().join("opt/homebrew/bin");
        executable(&brew.join(COMMAND));
        let mut env = fixture.env.clone();
        env.path.insert(0, brew.clone());

        let status = status(&env);

        assert_eq!(
            status,
            CliStatus::OnPath {
                path: display(&brew.join(COMMAND)),
                resolved: Some(display(
                    &fs::canonicalize(brew.join(COMMAND)).expect("canonical")
                )),
                managed: false,
            }
        );
        assert!(install(&env).unwrap_err().contains("already on PATH"));
        assert!(fs::symlink_metadata(fixture.link()).is_err());
    }

    #[test]
    fn install_links_the_bundled_cli_and_adds_the_zsh_path_block() {
        let fixture = Fixture::new(ShellKind::Zsh);
        let profile = fixture.env.home.join(".zprofile");
        fs::write(&profile, "eval \"$(/opt/homebrew/bin/brew shellenv)\"\n").expect("seed");

        let (link, target, change, managed) = ready(status(&fixture.env));
        assert!(!managed);
        assert_eq!(link, display(&fixture.link()));
        assert_eq!(
            change,
            Some(PathChange {
                file: display(&profile),
                line: POSIX_PATH_LINE.to_string()
            })
        );

        let hint = install(&fixture.env).expect("install");

        assert_eq!(hint.as_deref(), Some(POSIX_PATH_LINE));
        assert_eq!(
            fs::read_link(fixture.link()).expect("link"),
            PathBuf::from(target)
        );
        assert_eq!(
            fs::read_to_string(&profile).expect("profile"),
            format!(
                "eval \"$(/opt/homebrew/bin/brew shellenv)\"\n\n{BLOCK_BEGIN}\n{POSIX_PATH_LINE}\n{BLOCK_END}\n"
            )
        );
    }

    #[test]
    fn the_installed_link_is_reported_as_managed_and_can_be_uninstalled() {
        let fixture = Fixture::new(ShellKind::Zsh).with_local_bin_on_path();
        install(&fixture.env).expect("install");

        match status(&fixture.env) {
            CliStatus::OnPath { path, managed, .. } => {
                assert_eq!(path, display(&fixture.link()));
                assert!(managed);
            }
            other => panic!("expected OnPath, got {other:?}"),
        }

        uninstall(&fixture.env).expect("uninstall");
        assert!(fs::symlink_metadata(fixture.link()).is_err());
        assert!(matches!(status(&fixture.env), CliStatus::Ready { .. }));
    }

    #[test]
    fn local_bin_already_on_path_needs_no_startup_file_change() {
        let fixture = Fixture::new(ShellKind::Zsh).with_local_bin_on_path();

        let (_, _, change, _) = ready(status(&fixture.env));
        assert_eq!(change, None);
        assert_eq!(install(&fixture.env).expect("install"), None);
        assert!(!fixture.env.home.join(".zprofile").exists());
    }

    #[test]
    fn repeated_installs_keep_a_single_path_block() {
        let fixture = Fixture::new(ShellKind::Bash);
        install(&fixture.env).expect("first install");
        install(&fixture.env).expect("second install");

        let text = fs::read_to_string(fixture.env.home.join(".bash_profile")).expect("profile");
        assert_eq!(text.matches(BLOCK_BEGIN).count(), 1);
        assert_eq!(
            text,
            format!("{BLOCK_BEGIN}\n{POSIX_PATH_LINE}\n{BLOCK_END}\n")
        );
    }

    #[test]
    fn upsert_refreshes_an_outdated_block_in_place() {
        let text = format!("a\n{BLOCK_BEGIN}\nexport PATH=old\n{BLOCK_END}\nb\n");

        assert_eq!(
            upsert_block(&text, POSIX_PATH_LINE).as_deref(),
            Some(format!("a\n{BLOCK_BEGIN}\n{POSIX_PATH_LINE}\n{BLOCK_END}\nb\n").as_str())
        );
        assert_eq!(
            upsert_block("x", "line").as_deref(),
            Some(format!("x\n\n{BLOCK_BEGIN}\nline\n{BLOCK_END}\n").as_str())
        );
    }

    #[test]
    fn fish_gets_a_conf_d_file_with_fish_add_path() {
        let fixture = Fixture::new(ShellKind::Fish);

        let hint = install(&fixture.env).expect("install");

        let file = fixture.env.home.join(".config/fish/conf.d/nodetto.fish");
        assert_eq!(
            fs::read_to_string(file).expect("fish file"),
            format!("{FISH_FILE_HEADER}\n{FISH_PATH_LINE}\n")
        );
        assert_eq!(hint.as_deref(), Some(FISH_PATH_LINE));
    }

    #[test]
    fn a_symlinked_startup_file_is_written_through() {
        let fixture = Fixture::new(ShellKind::Zsh);
        let dotfile = fixture.root.path().join("dotfiles/zprofile");
        fs::create_dir_all(dotfile.parent().expect("parent")).expect("dirs");
        fs::write(&dotfile, "# mine\n").expect("seed");
        let profile = fixture.env.home.join(".zprofile");
        symlink(&dotfile, &profile).expect("symlink");

        install(&fixture.env).expect("install");

        assert!(fs::symlink_metadata(&profile)
            .expect("meta")
            .file_type()
            .is_symlink());
        assert!(fs::read_to_string(dotfile)
            .expect("dotfile")
            .contains(BLOCK_BEGIN));
    }

    #[test]
    fn a_foreign_file_at_the_link_path_blocks_the_install() {
        let fixture = Fixture::new(ShellKind::Zsh);
        executable(&fixture.link());

        let status = status(&fixture.env);

        assert!(
            matches!(status, CliStatus::Unavailable { reason } if reason.contains("not created by Nodetto"))
        );
        assert!(uninstall(&fixture.env).is_err());
        assert!(fixture.link().exists());
    }

    #[test]
    fn a_dangling_link_from_a_moved_app_is_replaced() {
        let fixture = Fixture::new(ShellKind::Zsh).with_local_bin_on_path();
        fs::create_dir_all(bin_dir(&fixture.env.home)).expect("bin");
        symlink(
            "/Old/Nodetto.app/Contents/MacOS/nodetto-cli",
            fixture.link(),
        )
        .expect("old link");

        let (_, target, _, managed) = ready(status(&fixture.env));
        assert!(managed);
        install(&fixture.env).expect("install");

        assert_eq!(
            fs::read_link(fixture.link()).expect("link"),
            PathBuf::from(target)
        );
    }

    #[test]
    fn running_from_a_disk_image_or_translocation_is_refused() {
        for location in [
            "/Volumes/Nodetto/Nodetto.app/Contents/MacOS/nodetto-cli",
            "/private/var/folders/x/AppTranslocation/y/d/Nodetto.app/Contents/MacOS/nodetto-cli",
        ] {
            let mut env = Fixture::new(ShellKind::Zsh).env;
            env.bundled = Some(PathBuf::from(location));
            assert!(
                matches!(status(&env), CliStatus::Unavailable { reason } if reason.contains("Applications"))
            );
        }
    }

    #[test]
    fn sandboxed_and_non_macos_builds_cannot_install() {
        let mut env = Fixture::new(ShellKind::Zsh).env;
        env.sandboxed = true;
        assert!(
            matches!(status(&env), CliStatus::Unavailable { reason } if reason.contains("App Store"))
        );

        let mut env = Fixture::new(ShellKind::Zsh).env;
        env.macos = false;
        assert!(
            matches!(status(&env), CliStatus::Unavailable { reason } if reason.contains("macOS"))
        );
    }

    #[test]
    fn shell_path_is_read_between_markers() {
        let output = format!("motd noise\n{PATH_BEGIN}/a:/b{PATH_END}\nmore");

        assert_eq!(parse_shell_path(&output).as_deref(), Some("/a:/b"));
        assert_eq!(parse_shell_path("no markers"), None);
        assert_eq!(
            split_path("/a::/b:"),
            vec![PathBuf::from("/a"), PathBuf::from("/b")]
        );
    }

    #[test]
    fn status_serializes_with_a_state_tag() {
        let json = serde_json::to_value(CliStatus::Ready {
            link: "/l".into(),
            target: "/t".into(),
            path_change: None,
            managed_link: false,
        })
        .expect("json");

        assert_eq!(json["state"], "ready");
        assert_eq!(json["managedLink"], false);
        assert!(json["pathChange"].is_null());
    }
}
