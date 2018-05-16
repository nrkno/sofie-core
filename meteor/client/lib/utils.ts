export function normalizeArray<T> (array: Array<T>, indexKey: keyof T) {
	const normalizedObject: any = {}
	for (let i = 0; i < array.length; i++) {
		const key = array[i][indexKey]
		normalizedObject[key] = array[i]
	}
	return normalizedObject as { [key: string]: T }
}
