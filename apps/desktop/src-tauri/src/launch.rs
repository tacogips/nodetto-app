// Documents the OS asks the app to open.
//
// A path can arrive before the webview is listening: on the command line
// (`nodetto file.jsonl`) or, on macOS, as an open-documents event that
// launches the app (`open -a nodetto file.jsonl`, Finder "Open With"). A
// nodetto://open?path=<absolute path>&page=<page id> link (or
// pageNumber=<n>) arrives the same ways and also names the page to show.
// Requests queue here until the frontend takes them; a request that arrives
// while the app runs also emits an event so the frontend takes it
// immediately.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Url};

/// Emitted (without payload) when new requests are queued.
pub const OPEN_REQUESTED_EVENT: &str = "open-documents-requested";

/// The URL scheme registered for the app (see Info.plist).
pub const LINK_SCHEME: &str = "nodetto";

/// A document to open; a link may also choose its page.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequest {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_number: Option<u32>,
}

/// Something the OS handed over: a path or a nodetto:// link.
pub enum LaunchTarget {
    Path(PathBuf),
    Link(Url),
}

impl LaunchTarget {
    /// A process argument. Linux desktop launchers pass a clicked link, or a
    /// file as a path or a file:// URL, this way (`Exec=nodetto %U`).
    pub fn from_arg(arg: String) -> Self {
        Url::parse(&arg)
            .ok()
            .and_then(Self::from_url)
            .unwrap_or_else(|| Self::Path(PathBuf::from(arg)))
    }

    /// An open event URL (macOS) or URL argument: a file, or one of our links.
    pub fn from_url(url: Url) -> Option<Self> {
        match url.scheme() {
            "file" => url.to_file_path().ok().map(Self::Path),
            LINK_SCHEME => Some(Self::Link(url)),
            _ => None,
        }
    }

    fn request(self) -> Option<LaunchRequest> {
        match self {
            Self::Path(path) => document_path(&path).map(|path| LaunchRequest {
                path,
                page: None,
                page_number: None,
            }),
            Self::Link(url) => link_request(&url),
        }
    }
}

/// `nodetto://open?path=...`; the path must be absolute because a link has
/// no working directory to resolve against.
fn link_request(url: &Url) -> Option<LaunchRequest> {
    if url.host_str() != Some("open") {
        return None;
    }
    let mut path = None;
    let mut page = None;
    let mut page_number = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "path" => path = Some(PathBuf::from(value.as_ref())),
            "page" if !value.is_empty() => page = Some(value.into_owned()),
            "pageNumber" => page_number = value.parse::<u32>().ok().filter(|n| *n > 0),
            _ => {}
        }
    }
    let path = path.filter(|path| path.is_absolute())?;
    Some(LaunchRequest {
        path: document_path(&path)?,
        page_number: if page.is_some() { None } else { page_number },
        page,
    })
}

#[derive(Default)]
pub struct LaunchState(Mutex<Vec<LaunchRequest>>);

impl LaunchState {
    /// Seed the queue from process arguments (the first is the executable).
    pub fn from_args(args: impl IntoIterator<Item = String>) -> Self {
        Self(Mutex::new(requests(
            args.into_iter().skip(1).map(LaunchTarget::from_arg),
        )))
    }

    /// Queue `targets`; true when at least one usable request was added.
    pub fn push(&self, targets: impl IntoIterator<Item = LaunchTarget>) -> bool {
        let usable = requests(targets);
        if usable.is_empty() {
            return false;
        }
        match self.0.lock() {
            Ok(mut pending) => {
                pending.extend(usable);
                true
            }
            Err(_) => false,
        }
    }

    pub fn take(&self) -> Vec<LaunchRequest> {
        self.0
            .lock()
            .map(|mut pending| std::mem::take(&mut *pending))
            .unwrap_or_default()
    }
}

/// Keep requests for existing regular files only, as absolute paths; flags
/// such as `-psn_...` that macOS may pass are not files and drop out here.
pub fn requests(targets: impl IntoIterator<Item = LaunchTarget>) -> Vec<LaunchRequest> {
    targets
        .into_iter()
        .filter_map(LaunchTarget::request)
        .collect()
}

fn document_path(path: &Path) -> Option<String> {
    if path.as_os_str().to_string_lossy().starts_with('-') || !path.is_file() {
        return None;
    }
    Some(absolute(path).to_string_lossy().into_owned())
}

fn absolute(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Queue targets from a running-app open request and notify the frontend.
pub fn request_open<R: Runtime>(app: &AppHandle<R>, targets: Vec<LaunchTarget>) {
    if app.state::<LaunchState>().push(targets) {
        let _ = app.emit(OPEN_REQUESTED_EVENT, ());
    }
}

#[tauri::command]
pub fn take_launch_requests(state: State<'_, LaunchState>) -> Vec<LaunchRequest> {
    state.take()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_existing_files_and_drops_flags_and_missing_paths() {
        let directory = tempfile::tempdir().unwrap();
        let document = directory.path().join("schema.jsonl");
        std::fs::write(&document, "").unwrap();
        let state = LaunchState::from_args([
            "nodetto".to_string(),
            "-psn_0_12345".to_string(),
            document.to_string_lossy().into_owned(),
            directory
                .path()
                .join("missing.jsonl")
                .to_string_lossy()
                .into_owned(),
            directory.path().to_string_lossy().into_owned(),
        ]);
        let taken = state.take();
        assert_eq!(taken.len(), 1);
        assert!(taken[0].path.ends_with("schema.jsonl"));
        assert!(Path::new(&taken[0].path).is_absolute());
        assert_eq!(taken[0].page, None);
        assert!(state.take().is_empty());
    }

    #[test]
    fn push_reports_whether_anything_was_queued() {
        let directory = tempfile::tempdir().unwrap();
        let document = directory.path().join("a.jsonl");
        std::fs::write(&document, "").unwrap();
        let state = LaunchState::default();
        assert!(!state.push([LaunchTarget::Path(directory.path().join("nope.jsonl"))]));
        assert!(state.push([LaunchTarget::Path(document)]));
        assert_eq!(state.take().len(), 1);
    }

    fn link(path: &Path, query: &str) -> String {
        let mut url = Url::parse("nodetto://open").unwrap();
        url.query_pairs_mut()
            .append_pair("path", &path.to_string_lossy());
        format!("{url}{query}")
    }

    #[test]
    fn links_and_file_urls_carry_an_existing_file_and_its_page() {
        let directory = tempfile::tempdir().unwrap();
        let document = directory.path().join("a b&c.jsonl");
        std::fs::write(&document, "").unwrap();
        let state = LaunchState::from_args([
            "nodetto".to_string(),
            document.to_string_lossy().into_owned(),
            link(&document, "&page=AbC123xyz_-"),
            link(&document, "&pageNumber=3"),
            link(&document, "&pageNumber=0"),
            link(&directory.path().join("missing.jsonl"), "&page=x"),
            "nodetto://open?path=relative.jsonl&page=x".to_string(),
            format!("nodetto://other?path={}", document.to_string_lossy()),
            Url::from_file_path(&document).unwrap().to_string(),
        ]);
        let taken = state.take();
        let pages: Vec<_> = taken
            .iter()
            .map(|request| (request.page.as_deref(), request.page_number))
            .collect();
        assert_eq!(
            pages,
            vec![
                (None, None),
                (Some("AbC123xyz_-"), None),
                (None, Some(3)),
                (None, None),
                (None, None)
            ]
        );
        assert!(taken
            .iter()
            .all(|request| request.path.ends_with("a b&c.jsonl")));
    }

    #[test]
    fn open_event_urls_accept_files_and_links_only() {
        let directory = tempfile::tempdir().unwrap();
        let document = directory.path().join("a.jsonl");
        std::fs::write(&document, "").unwrap();
        let urls = [
            Url::from_file_path(&document).unwrap(),
            Url::parse(&link(&document, "&page=p1")).unwrap(),
            Url::parse("https://example.com/a.jsonl").unwrap(),
        ];
        let taken = requests(urls.into_iter().filter_map(LaunchTarget::from_url));
        assert_eq!(taken.len(), 2);
        assert_eq!(taken[1].page.as_deref(), Some("p1"));
    }

    #[test]
    fn requests_serialize_with_camel_case_and_omit_missing_pages() {
        let request = LaunchRequest {
            path: "/a.jsonl".into(),
            page: None,
            page_number: Some(2),
        };
        assert_eq!(
            serde_json::to_string(&request).unwrap(),
            r#"{"path":"/a.jsonl","pageNumber":2}"#
        );
    }
}
