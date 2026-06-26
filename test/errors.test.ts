import { describe, it, expect } from "vitest";
import { AxiError } from "axi-sdk-js";
import { mapLinearError } from "../src/errors.js";

describe("mapLinearError", () => {
  it("maps an authentication error to AUTH_ERROR with a key suggestion", () => {
    const err = mapLinearError(
      [
        {
          message: "Authentication required",
          extensions: { type: "authentication error" },
        },
      ],
      200,
    );
    expect(err).toBeInstanceOf(AxiError);
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.suggestions.join(" ")).toMatch(/LINEAR_API_KEY/);
  });

  it("treats a bare HTTP 401 (no GraphQL errors) as AUTH_ERROR", () => {
    const err = mapLinearError(undefined, 401);
    expect(err.code).toBe("AUTH_ERROR");
  });

  it("maps a rate-limit error to RATE_LIMITED with a wait suggestion", () => {
    const err = mapLinearError(
      [{ message: "Rate limit exceeded", extensions: { type: "ratelimited" } }],
      200,
    );
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.suggestions.join(" ")).toMatch(/wait/i);
  });

  it("treats an HTTP 429 as RATE_LIMITED", () => {
    const err = mapLinearError(undefined, 429);
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("maps a not-found message to NOT_FOUND", () => {
    const err = mapLinearError(
      [
        {
          message: "Entity not found: Issue - Could not find referenced Issue.",
        },
      ],
      200,
    );
    expect(err.code).toBe("NOT_FOUND");
  });

  it("maps invalid input to VALIDATION_ERROR and prefers userPresentableMessage", () => {
    const err = mapLinearError(
      [
        {
          message: "Argument Validation Error",
          extensions: {
            type: "invalid input",
            userPresentableMessage: "Title can't be blank.",
          },
        },
      ],
      200,
    );
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Title can't be blank.");
  });

  it("falls back to UNKNOWN with the first error message", () => {
    const err = mapLinearError([{ message: "Something odd happened" }], 200);
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("Something odd happened");
  });

  it("maps a 5xx with no errors to a server error", () => {
    const err = mapLinearError(undefined, 503);
    expect(err.code).toBe("SERVER_ERROR");
  });
});
