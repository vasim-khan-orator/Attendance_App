export function getErrorMessageFromPayload(payload, fallbackMessage = "Request failed") {
  if (!payload) return fallbackMessage;

  if (typeof payload === "string") {
    return payload || fallbackMessage;
  }

  if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message;
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallbackMessage;
}

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text } : null;
  } catch {
    return null;
  }
}

export async function parseFetchResponseOrThrow(response, fallbackMessage = "Request failed") {
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const message = getErrorMessageFromPayload(payload, fallbackMessage);
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function getApiErrorMessage(error, fallbackMessage = "Request failed") {
  if (!error) return fallbackMessage;

  const axiosPayload = error.response?.data;
  if (axiosPayload) {
    return getErrorMessageFromPayload(axiosPayload, fallbackMessage);
  }

  if (error.payload) {
    return getErrorMessageFromPayload(error.payload, fallbackMessage);
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
