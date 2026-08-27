export function isLocalOrPlaceholderHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost"
    || host === "127.0.0.1"
    || host === "::1"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".example")
    || host.endsWith(".invalid")
    || host.endsWith(".test")
    || ["example.com", "example.net", "example.org"].includes(host);
}
