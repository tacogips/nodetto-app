import { expect, test } from "bun:test";
import { duplicateIdWarnings } from "./export-duplicates.ts";
import { parseXml } from "./xml.ts";

function scan(contents: string) {
  return duplicateIdWarnings(
    parseXml(`<bpmn:definitions
    xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:ext="urn:example:ext">${contents}</bpmn:definitions>`),
  );
}

const warning = (id: string) => ({
  message: `Duplicate BPMN id ${id} was emitted.`,
});

test("unique model and diagram ids are clean", () => {
  expect(
    scan(
      '<bpmn:task id="A"/><bpmn:task id="B"/><bpmndi:BPMNShape id="A_di"/><bpmndi:BPMNShape id="B_di"/>',
    ),
  ).toEqual([]);
});
test("a repeated id produces one warning", () => {
  expect(scan('<bpmn:task id="A"/><bpmn:task id="A"/>')).toEqual([
    warning("A"),
  ]);
});
test("a tripled id produces one warning", () => {
  expect(
    scan('<bpmn:task id="A"/><bpmn:task id="A"/><bpmn:task id="A"/>'),
  ).toEqual([warning("A")]);
});
test("model and diagram ids share a scope", () => {
  expect(scan('<bpmn:task id="A_di"/><bpmndi:BPMNShape id="A_di"/>')).toEqual([
    warning("A_di"),
  ]);
});
test("extension elements are excluded", () => {
  expect(
    scan(
      '<bpmn:task><bpmn:extensionElements><ext:field id="amount"/><bpmn:task id="X"/><bpmn:task id="X"/></bpmn:extensionElements></bpmn:task><bpmn:task><bpmn:extensionElements><ext:field id="amount"/></bpmn:extensionElements></bpmn:task>',
    ),
  ).toEqual([]);
});
test("foreign wrappers exclude their descendants", () => {
  expect(
    scan('<ext:wrapper><bpmn:task id="X"/><bpmn:task id="X"/></ext:wrapper>'),
  ).toEqual([]);
});
test("warnings follow first occurrence rather than repetition order", () => {
  expect(
    scan(
      '<bpmn:task id="B"/><bpmn:task id="A"/><bpmn:task id="A"/><bpmn:task id="B"/>',
    ),
  ).toEqual([warning("B"), warning("A")]);
});
test("prefixed id attributes do not count", () => {
  expect(scan('<bpmn:task ext:id="A"/><bpmn:task ext:id="A"/>')).toEqual([]);
});
