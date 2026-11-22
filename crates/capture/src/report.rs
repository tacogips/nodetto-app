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
        let mut json = format!(
            "{{\"width\":{},\"height\":{},\"bodies\":[",
            self.width, self.height
        );
        for (index, body) in self.bodies.iter().enumerate() {
            comma(&mut json, index);
            let _ = write!(
                json,
                "{{\"state\":\"{}\",\"emptiedByStep\":{},\"open\":{}}}",
                body.state.name(),
                body.emptied_by_step,
                body.open
            );
        }
        json.push_str("],\"analysis\":");
        if let Some(analysis) = &self.analysis {
            let _ = write!(
                json,
                "{{\"cell\":{:.3},\"candidates\":{},\"checked\":{},\"unchecked\":[",
                analysis.cell, analysis.candidates, analysis.checked
            );
            for (index, (a, b)) in analysis.unchecked.iter().enumerate() {
                comma(&mut json, index);
                let _ = write!(json, "[{a},{b}]");
            }
            let _ = write!(json, "],\"uncheckedCount\":{}}}", analysis.unchecked_count);
        } else {
            json.push_str("null");
        }
        json.push_str(",\"pairs\":[");
        for (index, pair) in self.pairs.iter().enumerate() {
            comma(&mut json, index);
            let [x, y, z] = pair.min;
            let [xx, yy, zz] = pair.max;
            let source = if pair.from_view { "view" } else { "analysis" };
            let _ = write!(
                json,
                "{{\"a\":{},\"b\":{},\"volume\":{:.3},\"min\":[{x:.3},{y:.3},{z:.3}],\"max\":[{xx:.3},{yy:.3},{zz:.3}],\"source\":\"{source}\",\"capped\":{}}}",
                pair.a, pair.b, pair.volume, pair.capped
            );
        }
        json.push_str("]}");
        json
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
        assert_eq!(
            report.to_json(),
            concat!(
                r#"{"width":128,"height":64,"bodies":[{"state":"outside","emptiedByStep":3,"open":true}],"#,
                r#""analysis":{"cell":0.250,"candidates":4,"checked":2,"unchecked":[[0,1],[0,2]],"uncheckedCount":2},"pairs":["#,
                r#"{"a":0,"b":1,"volume":1.235,"min":[-1.000,2.000,3.000],"max":[4.000,5.000,6.000],"source":"analysis","capped":true},"#,
                r#"{"a":1,"b":2,"volume":0.000,"min":[1.000,2.000,3.000],"max":[2.000,3.000,4.000],"source":"view","capped":false}]}"#,
            ),
        );
    }
}
