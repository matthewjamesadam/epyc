/*
    Centralized logging.  For now this just goes to the console.
*/
export class Logger {
    static log(message: string) {
        console.log(message);
    }

    static error(message: string) {
        console.error(message);
    }

    static exception(error: any, message?: string) {
        if (message) {
            console.error(message);
        }

        console.error(error);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}
