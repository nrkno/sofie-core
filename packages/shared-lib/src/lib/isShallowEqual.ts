export default function isShallowEqual(a: any[], b: any[]): boolean {
	if (a.length !== b.length) return false
	return a.every((value, index) => value === b[index])
}
