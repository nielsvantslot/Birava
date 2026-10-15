import { describe, expect, it } from "vitest";
import { ContentSecurityPolicyBuilder } from "./ContentSecurityPolicyBuilder";

describe("ContentSecurityPolicyBuilder connect-src", () => {
  it("lets the browser reach both hosts the direct-to-Blob upload uses", () => {
    const { headerValue } = ContentSecurityPolicyBuilder.build();
    const connect = headerValue.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src")) ?? "";

    expect(connect).toContain("https://*.blob.vercel-storage.com");
    expect(connect).toContain("https://vercel.com/api/blob/");
  });
});
