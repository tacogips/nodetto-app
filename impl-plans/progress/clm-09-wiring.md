# clm-09 wiring progress

Workflow: issue-resolution. Plan: impl-plans/active/clm-09-wiring.md.
Dependency admission: clm-02 and clm-11 accepted by runtime contract.

Partial implementation: registered merge and layered/route dispatch, BPMN three-list
planner dispatch, diagram lint and metrics, synchronous and asynchronous quiet,
warning collapse, selector match result, core exports, MCP discovery assertions,
and initial help and documentation. Per-edit intentions and pre/post git blob hashes
are in tmp/clm-s737/clm-09-wiring/edits/; predecessor apply-batch behavior was retained.

Focused suites: focused-6.log: 104 pass, 0 fail; focused-7.log: 123 pass,
0 fail. typecheck-final-2.log: exit 0. strict-gate-3.log: exit 0; underlying
strict-3.log includes out-of-scope test diagnostics. Earlier attempts remain in
plan-local evidence. These checks do not establish full plan completion.

Continuation 5: accepted clm-09a, clm-09b and clm-09c changes are present. The C3-COLLAPSE-OWNER review explicitly adds feature logic and tests for BPMN import/export, draw.io import and DDL warnings to this plan; this is a scoped exception to the no-feature-logic and no-new-tests limits. Grouping uses message text; strict retains the real counts and quiet suppresses warning lines. Gerber, PCB and breadboard warnings remain per line. Repeated DDL warnings are tested using three duplicate table names.

The combined diff was reviewed against the Continuation 5 partition. Documentation, CLI and native parity coverage are present; protected depth-one fixtures, planner, MCP and obstacle fixtures match originalHead. E2 is not fully met for Q11 conflict inputs. The final verification and timing evidence is under tmp/clm-s740/clm-09-wiring/. Formal independent review remains downstream.

final A7 medians release: single1=0.57 multi1=1.02 single50=0.84 multi50=1.29 mixedSingle=0.90 mixedMulti=1.36
final A7 medians before: single1=0.55 multi1=1.26 single50=0.79 multi50=1.53 mixedSingle=0.87 mixedMulti=1.77
final A7 marginal ratio batch: 1.0000
final A7 marginal ratio mixed: 1.0303
final arrange route user: 8.60
final arrange layered user: 60=1.23 120=2.37

Q11 open: depth-one containment not accepted for conflict inputs
