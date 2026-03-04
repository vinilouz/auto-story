interface ProcessResponse {
  done: boolean;
  processed: number;
  remaining: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startProcessing(): Promise<void> {
  let done = false;

  while (!done) {
    const response = await fetch("/api/queue/process", { method: "POST" });
    const result = (await response.json()) as ProcessResponse;

    console.log(
      `Processed: ${result.processed}, Remaining: ${result.remaining}`,
    );

    if (result.done) {
      done = true;
    } else {
      await sleep(2000);
    }
  }
}
