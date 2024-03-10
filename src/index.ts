import ansis from "ansis";
import { inspect } from "util";

export abstract class Widget {
    constructor(protected logger: Logger) {}

    public abstract render(): string;
}

const SPINNER_STYLES = {
    dots: ["⠇", "⠋", "⠙", "⠸", "⠴", "⠦"],
    geometry: ["▱▱▱▱▱", "▰▱▱▱▱", "▰▰▱▱▱", "▰▰▰▱▱", "▰▰▰▰▱", "▰▰▰▰▰"],
    classic: ["|", "/", "-", "\\"],
    fill: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"],
    sus: ["     ", "    ඞ", "   ඞ ", "  ඞ  ", " ඞ   ", "ඞ    ", "     "],
} as const;

export type SpinnerStyle = keyof typeof SPINNER_STYLES;

export interface SpinnerOptions {
    style?: SpinnerStyle;
}

export class SpinnerWidget extends Widget {
    private index = 0;

    constructor(
        logger: Logger,
        private text: string,
        private opts?: SpinnerOptions,
    ) {
        super(logger);
    }

    update(text: string) {
        this.text = text;
    }

    render() {
        const animation = SPINNER_STYLES[this.opts?.style ?? "dots"];
        const current = animation[this.index];
        this.index = (this.index + 1) % animation.length;

        return `${ansis.gray`[`}${ansis.yellow(current)}${ansis.gray`]`} ${
            this.text
        }`;
    }

    success(message: string) {
        this.logger.remove(this);
        this.logger.done(message);
    }

    error(message: string) {
        this.logger.remove(this);
        this.logger.fail(message);
    }
}

const PROGRESS_BAR_STYLES = {
    shadow: {
        25: "░",
        50: "▒",
        75: "▓",
        100: "█",
    },
    block: {
        12.5: "▏",
        25: "▎",
        37.5: "▍",
        50: "▌",
        62.5: "▋",
        75: "▊",
        87.5: "▉",
        100: "█",
    },
    classic: {
        100: "=",
    },
    line: {
        0: ansis.gray`─`,
        100: ansis.green`─`,
    },
} as const;

export type ProgressBarStyle = keyof typeof PROGRESS_BAR_STYLES;

export interface ProgressBarOptions {
    value?: number;
    max: number;
    style?: ProgressBarStyle;
    format?: string;
    width?: number;
    spinnerStyle?: SpinnerStyle;
}

export class ProgressBarWidget extends Widget {
    private value: number = 0;
    private start: number = 0;
    private anim: number = 0;
    private extraTokens: Record<string, any> = {};

    constructor(
        logger: Logger,
        private options: ProgressBarOptions,
    ) {
        super(logger);

        this.start = performance.now();
    }

    public stop() {
        this.logger.remove(this);
    }

    public update(value: number, extraTokens?: Record<string, any>) {
        this.value = Math.min(value, this.options.max);
        if (extraTokens) this.extraTokens = extraTokens;
    }

    public step(value: number, extraTokens?: Record<string, any>) {
        this.update(this.value + value, extraTokens);
    }

    public render(): string {
        const delta = performance.now() - this.start;
        const itemTime = delta / this.value;
        const etaTime = itemTime * (this.options.max - this.value);

        const options: Record<string, string | number> = {
            value: this.value,
            max: this.options.max,
            eta: formatDeltaTime(etaTime),
            eta_rounded: formatDeltaTime(etaTime, true),
            bar: this.getProgressBar(),
            progress: Math.round((this.value / this.options.max) * 100),
            spinner: this.getSpinner(),
        };

        let bar = this.options.format ?? "{bar}";

        for (const template in options) {
            bar = bar.replaceAll(`{${template}}`, options[template].toString());
        }

        for (const template in this.extraTokens) {
            bar = bar.replaceAll(`{${template}}`, options[template].toString());
        }

        return bar;
    }

    private getSpinner(): string {
        const style = SPINNER_STYLES[this.options.spinnerStyle ?? "dots"];
        const curr = style[this.anim];

        this.anim = (this.anim + 1) % style.length;

        return curr;
    }

    private getProgressBar(): string {
        const currentStyle =
            PROGRESS_BAR_STYLES[this.options.style ?? "shadow"];
        const width = this.options.width ?? 20;
        let progress = (this.value / this.options.max) * width;
        let bar = "";
        let realWidth = 0;

        while (progress >= 1) {
            bar += currentStyle[100];
            realWidth++;
            progress -= 1;
        }

        if (progress >= 0) {
            let max: keyof typeof currentStyle | null = null;

            for (const key in currentStyle) {
                const p = Number(key) as keyof typeof currentStyle;

                if (p === 100) continue;
                if (progress * 100 >= p && (!max || max < p)) max = p;
            }

            if (max) {
                bar += currentStyle[max];
                realWidth++;
            }
        }

        return (
            bar +
            (0 in currentStyle ? currentStyle[0] : " ").repeat(
                Math.max(width - realWidth, 0),
            )
        );
    }
}

function argToString(arg: any): string {
    if (typeof arg === "string") return arg;
    return inspect(arg, { colors: true });
}

function argsToString(...args: any[]): string {
    let out = "";

    for (let i = 0; i < args.length; i++) {
        if (out.length !== 0) out += " ";

        if (typeof args[i] === "string" && i === 0)
            out += args[i].replace(/\{\}/g, () => argToString(args[++i]));
        else out += argToString(args[i]);
    }

    return out;
}

export type PromiseSpinnerOptions = SpinnerOptions & {
    message: string;
    success?: string;
    error?: string;
};

const LOG_LEVELS = [
    "error",
    "warn",
    "success",
    "info",
    "debug",
    "trace",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LoggerOptions {
    widgetMargin?: number;
    logLevel?: LogLevel;
}

export class Logger {
    private widgets: Widget[] = [];
    private lastWidgetCount: number = 0;
    private widgetLoop: NodeJS.Timeout;

    constructor(private options?: LoggerOptions) {
        this.widgetLoop = setInterval(() => this.redrawWidgets(), 100);
        this.widgetLoop.unref();
    }

    public fail = this.getLogger("error", ansis.red`✗`);
    public warn = this.getLogger("warn", ansis.yellow`!`);
    public info = this.getLogger("info", ansis.blueBright`i`);
    public done = this.getLogger("success", ansis.greenBright`✓`);
    public debug = this.getLogger("debug", ansis.yellowBright`d`);
    public trace(...args: any[]) {
        if (!this.canLog("trace")) return;

        const message = argsToString(...args);
        const stack = (new Error().stack ?? "\n").split("\n");
        stack[0] = `${ansis.gray`[`}${ansis.cyanBright`t`}${ansis.gray`]`} ${message}`;

        process.stdout.write(`\r\x1B[2K${stack.join("\n")}\r\n`);
    }

    public spinner(text: string, options?: SpinnerOptions) {
        const widget = new SpinnerWidget(this, text, options);
        this.widgets.push(widget);

        return widget;
    }

    public progress(options: ProgressBarOptions) {
        const widget = new ProgressBarWidget(this, options);
        this.widgets.push(widget);

        return widget;
    }

    public remove(widget: Widget) {
        this.widgets = this.widgets.filter((w) => w !== widget);
        this.redrawWidgets();
    }

    public promiseSpinner<T extends Promise<any>>(
        options: PromiseSpinnerOptions,
        promise: T,
    ): T {
        const spinner = this.spinner(options.message);

        return promise
            .then((data) => {
                spinner.success(options.success ?? "success");
                return data;
            })
            .catch((err) => {
                spinner.error(options.error ?? "error");
                return err;
            }) as any;
    }

    public async withSpinner(
        message: string,
        callback: (spinner: SpinnerWidget) => Promise<any> | any,
    ) {
        const spinner = this.spinner(message);
        await callback(spinner);
    }

    public async withProgress(
        options: ProgressBarOptions,
        callback: (progressBar: ProgressBarWidget) => Promise<any> | any,
    ) {
        const progressBar = this.progress(options);
        await callback(progressBar);
    }

    public removeAllWidgets() {
        this.widgets = [];
        this.redrawWidgets();
    }

    public configure(options: LoggerOptions) {
        this.options = Object.assign(this.options ?? {}, options);
    }

    private canLog(level: LogLevel) {
        const curr = LOG_LEVELS.indexOf(this.options?.logLevel ?? "trace");
        const comp = LOG_LEVELS.indexOf(level);

        return comp <= curr;
    }

    private getLogger(level: LogLevel, symbol: string) {
        const prefix = `\r\x1B[2K${ansis.gray`[`}${symbol}${ansis.gray`]`}`;

        return (...args: any[]) => {
            if (!this.canLog(level)) return;
            process.stdout.write(`${prefix} ${argsToString(...args)}\r\n`);
        };
    }

    private redrawWidgets() {
        if (this.lastWidgetCount === 0 && this.widgets.length === 0) return;

        let out = "";

        out += "\r\x1B[2K\r\n".repeat(this.options?.widgetMargin ?? 1);

        for (let i = 0; i < this.lastWidgetCount; i++) {
            if (i < this.widgets.length)
                out += `\r\x1B[2K${this.widgets[i].render()}\r\n`;
            else out += `\r\x1B[2K\r\n`;
        }

        out += `\x1B[${
            this.lastWidgetCount + (this.options?.widgetMargin ?? 1)
        }A`;

        process.stdout.write(out);

        this.lastWidgetCount = this.widgets.length;
    }
}

const TIME_SUFFIXES = {
    d: 1000 * 60 * 60 * 24,
    h: 1000 * 60 * 60,
    m: 1000 * 60,
    s: 1000,
} as const;

export function formatDeltaTime(delta: number, rounded: boolean = false) {
    for (const suffix in TIME_SUFFIXES) {
        const time =
            TIME_SUFFIXES[suffix as unknown as keyof typeof TIME_SUFFIXES];

        if (delta >= time)
            return `${
                rounded ? Math.round(delta / time) : (delta / time).toFixed(1)
            }${suffix}`;
    }

    return `${Math.round(delta)}ms`;
}

export default new Logger();
