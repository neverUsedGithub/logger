# @justcoding123/logger

A basic logging package with spinners and progress bars.

## Installation

```sh
npm i @justcoding123/logger
```

## Examples

### Basic Example

```ts
import logger from "@justcoding123/logger";

logger.info("Hello, World!");
logger.warn("This will print a warning");
logger.fail("Uh-oh, something failed");
logger.done("Something finished successfully");
```

### Spinners

```ts
import logger from "@justcoding123/logger";

const spinner = logger.spinner("Loading...");
await wait(1500);
spinner.update("Still loading...");
await wait(1500);
spinner.success("Finished successfully!");

await logger.withSpinner("Doing work", async (spinner) => {
    await wait(1000);
    spinner.update("Doing some more work");
    await wait(1000);
    spinner.error("Failed :(");
});

await logger.promiseSpinner(
    {
        message: "Waiting...",
        success: "Done waiting!",
        error: "Failed to wait?",
    },
    wait(1000),
);
```

### Progress Bars

```ts
import logger from "@justcoding123/logger";

logger.progress({
    format: "{spinner} {progress}% {bar} ETA: {eta}",
    max: 10,
});

logger.withProgress({ width: 10, max: 20 }, (bar) => {
    for (let i = 0; i <= 20; i++) bar.update(i);

    bar.stop();
});
```

### Log Levels

```ts
import logger from "@justcoding123/logger";

logger.configure({ logLevel: "error" });

logger.info("This is not printed");
```

### Templates

```ts
import logger from "@justcoding123/logger";

const name = "World";
logger.info("Hello, {}!", name);

logger.info("1, {},", 2, 3); // "1, 2, 3"
```
