export default class Utils {
    static notNull<T>(value: T | null | undefined): value is T {
        return value !== null && value !== undefined;
    }

    static shuffleArray<T>(array: T[]): T[] {
        const newArray = array.slice();

        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }

        return newArray;
    }

    static findRandomInArray<T>(array: T[], predicate: (value: T, index: number) => boolean): number {
        const indices = Utils.shuffleArray([...Array(array.length).keys()]);

        for (let index of indices) {
            if (predicate(array[index], index)) {
                return index;
            }
        }

        return -1;
    }
}
