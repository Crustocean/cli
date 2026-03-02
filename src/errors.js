export class CrustoceanAPIError extends Error {
  constructor(statusCode, message, body) {
    super(message);
    this.name = 'CrustoceanAPIError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

function friendlyMessage(err) {
  if (err instanceof CrustoceanAPIError) {
    switch (err.statusCode) {
      case 401: return 'Not logged in. Run `crustocean auth login` first.';
      case 403: return err.message;
      case 404: return `Not found — ${err.message}`;
      default:  return `${err.message} (${err.statusCode})`;
    }
  }
  if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
    return 'Could not connect to the API server.';
  }
  if (err.code === 'ENOTFOUND' || err.cause?.code === 'ENOTFOUND') {
    return 'Could not resolve API host.';
  }
  return err.message;
}

export function handleError(err, json) {
  if (json) {
    const out = { error: friendlyMessage(err) };
    if (err.statusCode) out.statusCode = err.statusCode;
    console.error(JSON.stringify(out));
    process.exit(1);
  }

  console.error(`Error: ${friendlyMessage(err)}`);
  process.exit(1);
}
