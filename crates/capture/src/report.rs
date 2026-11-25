//! Deterministic report shared by capture hosts.

use std::fmt::Write;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BodyState {
    Drawn,
    Hidden,
    Absent,
    Outside,
    Empty,
    Unknown,
}

impl BodyState {
    fn name(self) -> &'static str {
        match self {
            Self::Drawn => "drawn",
            Self::Hidden => "hidden",
            Self::Absent => "absent",
            Self::Outside => "outside",
            Self::Empty => "empty",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BodyReport {
    pub state: BodyState,
    pub emptied_by_step: i32,
    pub open: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Analysis {
    pub cell: f64,
    pub candidates: u32,
    pub checked: u32,
    pub unchecked: Vec<(u32, u32)>,
    pub unchecked_count: u32,
    pub capped_count: u32,
    pub capped_without_hit: Vec<(u32, u32)>,
    pub budget: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PairReport {
    pub a: u32,
    pub b: u32,
    pub volume: f64,
    pub min: [f64; 3],
    pub max: [f64; 3],
    pub from_view: bool,
    pub capped: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Report {
    pub width: u32,
    pub height: u32,
    pub bodies: Vec<BodyReport>,
    pub analysis: Option<Analysis>,
    pub pairs: Vec<PairReport>,
}

impl Report {
    pub fn to_json(&self) -> String {
        self.to_json_with_hidden(&[])
    }

    pub fn to_json_with_hidden(&self, hidden: &[Option<i32>]) -> String {
        let mut json = format!(
            "{{\"width\":{},\"height\":{},\"bodies\":[",
            self.width, self.height
        );
        for (index, body) in self.bodies.iter().enumerate() {
            comma(&mut json, index);
            let _ = write!(
                json,
                "{{\"state\":\"{}\",\"emptiedByStep\":{},\"open\":{}",
                body.state.name(),
                body.emptied_by_step,
                body.open
            );
            if let Some(Some(step)) = hidden.get(index) {
                let _ = write!(json, ",\"hiddenEmptiedByStep\":{step}");
            }
            json.push('}');
        }
        json.push_str("],\"analysis\":");
        if let Some(analysis) = &self.analysis {
            let _ = write!(
                json,
                "{{\"cell\":{:.3},\"candidates\":{},\"checked\":{},\"unchecked\":[",
                display_cell(analysis.cell),
                analysis.candidates,
                analysis.checked
            );
            for (index, (a, b)) in analysis.unchecked.iter().enumerate() {
                comma(&mut json, index);
                let _ = write!(json, "[{a},{b}]");
            }
            let _ = write!(
                json,
                "],\"uncheckedCount\":{},\"cappedCount\":{},\"budget\":{},\"cappedWithoutHit\":[",
                analysis.unchecked_count, analysis.capped_count, analysis.budget
            );
            for (index, (a, b)) in analysis.capped_without_hit.iter().enumerate() {
                comma(&mut json, index);
                let _ = write!(json, "[{a},{b}]");
            }
            json.push_str("]}");
        } else {
            json.push_str("null");
        }
        json.push_str(",\"pairs\":[");
        for (index, pair) in self.pairs.iter().enumerate() {
            comma(&mut json, index);
            let [x, y, z] = pair.min.map(finite);
            let [xx, yy, zz] = pair.max.map(finite);
            let source = if pair.from_view { "view" } else { "analysis" };
            let _ = write!(
                json,
                "{{\"a\":{},\"b\":{},\"volume\":{:.3},\"min\":[{x:.3},{y:.3},{z:.3}],\"max\":[{xx:.3},{yy:.3},{zz:.3}],\"source\":\"{source}\",\"capped\":{}}}",
                pair.a, pair.b, finite(pair.volume), pair.capped
            );
        }
        json.push_str("]}");
        json
    }
}

fn finite(value: f64) -> f64 {
    if value.is_finite() {
        value
    } else {
        0.0
    }
}

// The printed detection cell must be at least as large as the actual cell.
fn display_cell(value: f64) -> f64 {
    let value = finite(value);
    let scaled = value * 1000.0;
    if scaled.is_finite() {
        let nearest = scaled.round();
        if nearest / 1000.0 < value {
            (nearest + 1.0) / 1000.0
        } else {
            nearest / 1000.0
        }
    } else {
        value
    }
}

fn comma(json: &mut String, index: usize) {
    if index > 0 {
        json.push(',');
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_has_defined_values_for_nonfinite_reals_and_a_conservative_cell() {
        assert_eq!(display_cell(0.25), 0.25);
        assert_eq!(display_cell(0.25001), 0.251);
        assert_eq!(display_cell(f64::INFINITY), 0.0);
        let report = Report {
            width: 64,
            height: 64,
            bodies: Vec::new(),
            analysis: None,
            pairs: vec![PairReport {
                a: 0,
                b: 1,
                volume: f64::INFINITY,
                min: [f64::NAN, 1.0, 2.0],
                max: [1.0, 2.0, f64::NEG_INFINITY],
                from_view: false,
                capped: false,
            }],
        };
        assert!(report
            .to_json()
            .contains(r#""volume":0.000,"min":[0.000,1.000,2.000],"max":[1.000,2.000,0.000]"#));
    }

    #[test]
    fn serializes_analysis_and_pairs_in_wire_order() {
        let report = Report {
            width: 128,
            height: 64,
            bodies: vec![BodyReport {
                state: BodyState::Outside,
                emptied_by_step: 3,
                open: true,
            }],
            analysis: Some(Analysis {
                cell: 0.25,
                candidates: 4,
                checked: 2,
                unchecked: vec![(0, 1), (0, 2)],
                unchecked_count: 2,
                capped_count: 2,
                capped_without_hit: vec![(1, 3)],
                budget: 24_000_000,
            }),
            pairs: vec![
                PairReport {
                    a: 0,
                    b: 1,
                    volume: 1.23456,
                    min: [-1.0, 2.0, 3.0],
                    max: [4.0, 5.0, 6.0],
                    from_view: false,
                    capped: true,
                },
                PairReport {
                    a: 1,
                    b: 2,
                    volume: 0.0,
                    min: [1.0, 2.0, 3.0],
                    max: [2.0, 3.0, 4.0],
                    from_view: true,
                    capped: false,
                },
            ],
        };
        assert_eq!(report.to_json_with_hidden(&[None]), report.to_json());
        assert!(report
            .to_json_with_hidden(&[Some(3)])
            .contains(r#""open":true,"hiddenEmptiedByStep":3"#));
        assert_eq!(
            report.to_json(),
            concat!(
                r#"{"width":128,"height":64,"bodies":[{"state":"outside","emptiedByStep":3,"open":true}],"#,
                r#""analysis":{"cell":0.250,"candidates":4,"checked":2,"unchecked":[[0,1],[0,2]],"uncheckedCount":2,"cappedCount":2,"budget":24000000,"cappedWithoutHit":[[1,3]]},"pairs":["#,
                r#"{"a":0,"b":1,"volume":1.235,"min":[-1.000,2.000,3.000],"max":[4.000,5.000,6.000],"source":"analysis","capped":true},"#,
                r#"{"a":1,"b":2,"volume":0.000,"min":[1.000,2.000,3.000],"max":[2.000,3.000,4.000],"source":"view","capped":false}]}"#,
            ),
        );
    }
}
