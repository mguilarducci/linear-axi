import { describe, it, expect } from "vitest";
import {
  isOpenStateType,
  openIssueFilter,
  CLOSED_STATE_TYPES,
} from "../src/state.js";

describe("isOpenStateType", () => {
  it("treats backlog/unstarted/started/triage as open", () => {
    for (const t of ["triage", "backlog", "unstarted", "started"]) {
      expect(isOpenStateType(t)).toBe(true);
    }
  });

  it("treats completed and canceled as not open", () => {
    expect(isOpenStateType("completed")).toBe(false);
    expect(isOpenStateType("canceled")).toBe(false);
  });

  it("treats an unknown type as open so issues are never silently hidden", () => {
    expect(isOpenStateType("somethingNew")).toBe(true);
  });
});

describe("openIssueFilter", () => {
  it("builds a GraphQL filter excluding the closed state types", () => {
    expect(openIssueFilter()).toEqual({
      state: { type: { nin: CLOSED_STATE_TYPES } },
    });
  });
});
