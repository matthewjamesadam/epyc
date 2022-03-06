import dayjs from 'dayjs';

/*
    Centralized logging.  For now this just goes to the console.
*/
export class Logger {
    static log(message: string) {
        console.log(`${this.timestamp} -- ${message}`);
    }

    static error(message: string) {
        console.error(`${this.timestamp} -- ${message}`);
    }

    static exception(error: any, message?: string) {
        if (message) {
            console.error(`${this.timestamp} -- ${message}`);
        } else {
            console.error(this.timestamp);
        }

        console.error(error);
        if (error.stack) {
            console.error(error.stack);
        }
    }

    static get timestamp(): string | object {
        return dayjs().format();
    }
}
