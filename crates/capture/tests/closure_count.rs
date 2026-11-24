#[allow(dead_code)]
mod support;

use nodetto_capture::mesh::CLOSURE_EVALUATIONS;
use nodetto_capture::scene::{Op, Tool};
use nodetto_capture::{render_scene, ImageFormat};
use std::sync::atomic::Ordering;
use support::{body, cube_mesh, scene};

fn encode(scene: &nodetto_capture::scene::Scene) -> Vec<u8> {
    let mut out = b"NCS1\x01\x00\x00\x00".to_vec();
    fn u(out: &mut Vec<u8>, n: u32) {
        out.extend(n.to_le_bytes());
    }
    fn f(out: &mut Vec<u8>, n: f64) {
        out.extend(n.to_le_bytes());
    }
    for n in [
        scene.width,
        scene.height,
        scene.supersample,
        scene.tools.len() as u32,
        scene.bodies.len() as u32,
        if scene.analyse { 3 } else { 0 },
        if scene.analyse {
            scene.budget_million_rays
        } else {
            0
        },
        0,
    ] {
        u(&mut out, n);
    }
    for value in scene
        .camera
        .right
        .into_iter()
        .chain(scene.camera.up)
        .chain(scene.camera.forward)
        .chain(scene.camera.centre)
        .chain([
            scene.camera.mm_per_pixel,
            scene.tolerance,
            scene.target_cell,
        ])
    {
        f(&mut out, value);
    }
    for colour in [
        scene.colours.background,
        scene.colours.body,
        scene.colours.edge,
        scene.colours.interference,
    ] {
        out.extend(colour);
    }
    out.extend([scene.reference_opacity, 0, 0, 0]);
    for tool in &scene.tools {
        let Tool::Mesh(mesh) = tool else {
            panic!("mesh fixture expected")
        };
        u(&mut out, 1);
        u(&mut out, (mesh.positions.len() / 3) as u32);
        u(&mut out, (mesh.triangles.len() / 3) as u32);
        u(&mut out, 0);
        for &value in &mesh.positions {
            f(&mut out, value);
        }
        for &index in &mesh.triangles {
            u(&mut out, index);
        }
        if mesh.triangles.len() % 2 != 0 {
            u(&mut out, 0);
        }
    }
    for body in &scene.bodies {
        u(
            &mut out,
            u32::from(body.reference) | (u32::from(body.analysed) << 1),
        );
        u(&mut out, body.steps.len() as u32);
        for step in &body.steps {
            u(
                &mut out,
                match step.op {
                    Op::Union => 0,
                    Op::Difference => 1,
                    Op::Intersection => 2,
                },
            );
            u(&mut out, step.tool);
        }
    }
    out
}

#[test]
fn closure_is_evaluated_once_per_mesh_per_render() {
    for scenario in 0..3 {
        let closed = cube_mesh();
        let mut open = cube_mesh();
        if let Tool::Mesh(mesh) = &mut open {
            mesh.triangles.truncate(mesh.triangles.len() - 3);
        }
        let mut bodies = vec![body(&[(Op::Union, 0)]), body(&[(Op::Union, 1)])];
        if scenario == 1 {
            bodies.push(body(&[(Op::Union, 0)]));
            bodies[0].analysed = true;
            bodies[2].analysed = true;
        }
        if scenario == 2 {
            bodies[0] = body(&[(Op::Union, 0), (Op::Difference, 0)]);
        }
        let mut scene = scene(vec![closed, open], bodies);
        scene.analyse = scenario == 1;
        scene.draw_interference = scenario == 1;
        let bytes = encode(&scene);
        let mut previous = None;
        for threads in [1, 8] {
            let before = CLOSURE_EVALUATIONS.load(Ordering::Relaxed);
            let output = render_scene(&bytes, ImageFormat::Png, threads).unwrap();
            assert_eq!(
                CLOSURE_EVALUATIONS.load(Ordering::Relaxed) - before,
                2,
                "scenario {scenario}, threads {threads}"
            );
            let expected = [
                (8639454326142161060, 11259703679468420013),
                (16432782844150572793, 809704651836954282),
                (1038278858989252034, 18034829504782379159),
            ];
            assert_eq!(
                (
                    support::digest(&output.image),
                    support::digest(output.report.as_bytes())
                ),
                expected[scenario]
            );
            if scenario == 1 {
                assert!(output.report.contains("\"candidates\":1,\"checked\":1"));
                assert!(output.report.contains("\"source\":\"analysis\""));
            }
            if scenario == 2 {
                assert!(output
                    .report
                    .contains("\"state\":\"empty\",\"emptiedByStep\":1"));
            }
            if let Some((image, report)) = &previous {
                assert_eq!(&output.image, image);
                assert_eq!(&output.report, report);
            }
            previous = Some((output.image, output.report));
        }
    }
}
