import logger from "../src";

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

logger.configure({ logLevel: "debug" });

async function main() {
    const filename = "Hello.txt";
    logger.info("starting to download {}", filename);
    logger.warn("deprecation warning: --fast option was removed");
    logger.fail("download failed");
    logger.done("download completed");
    logger.debug("Hello, World!");

    logger.trace("trace this!!");

    logger.info();

    const spinners = (
        ["dots", "geometry", "classic", "fill", "sus"] as const
    ).map((style, i) => logger.spinner(`loading... ${i + 1}`, { style }));

    const progressBars = (["shadow", "block", "classic", "line"] as const).map(
        (style) =>
            logger.progress({
                format: "{spinner} {progress}% {bar} ETA: {eta}",
                max: 10,
                style,
            }),
    );

    for (let i = 1; i <= 10; i++) {
        for (const bar of progressBars) bar.update(i);
        await wait(300);
    }

    for (const bar of progressBars) bar.stop();
    for (let i = 0; i < spinners.length; i++)
        spinners[i].success(`success :-) ${i + 1}`);

    await logger.promiseSpinner(
        {
            message: "Waiting...",
            success: "Done waiting!",
            error: "Failed to wait?",
        },
        wait(5000),
    );
}

main();
