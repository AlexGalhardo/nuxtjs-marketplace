// `bun run setup:<flavor>`: runs the matching setups/*.sh for this OS (Git Bash on Windows).
import { existsSync } from 'node:fs'

const flavors = ['sqlite', 'postgres-local', 'postgres-with-docker'] as const
type Flavor = (typeof flavors)[number]

const flavor = process.argv[2] as Flavor
if (!flavors.includes(flavor)) {
	console.error(`usage: bun run scripts/setup.ts <${flavors.join('|')}>`)
	process.exit(1)
}

const isWindows = process.platform === 'win32'
const script = `setups/setup-${isWindows ? 'windows' : 'unix'}-using-${flavor}.sh`

// On Windows a bare `bash` can resolve to WSL's System32\bash.exe, which runs in another filesystem; prefer Git Bash.
function findBash(): string {
	if (!isWindows) return 'bash'
	const candidates = [
		`${process.env.ProgramFiles}\\Git\\bin\\bash.exe`,
		`${process.env['ProgramFiles(x86)']}\\Git\\bin\\bash.exe`,
		`${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
	]
	const found = candidates.find((path) => existsSync(path))
	if (!found) {
		console.error('Git Bash not found. Install Git for Windows: winget install Git.Git')
		process.exit(1)
	}
	return found
}

const child = Bun.spawn([findBash(), script], {
	stdio: ['inherit', 'inherit', 'inherit'],
	env: { ...process.env, SETUP_NO_PAUSE: '1' },
})
process.exit(await child.exited)
