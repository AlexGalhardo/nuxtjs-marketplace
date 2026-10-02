// `bun run release <patch|minor|major>`: turns CHANGELOG.md's [Unreleased] section into the next version
// (Keep a Changelog), bumps package.json, commits and tags. Pushing the tag publishes the release (release.yml).
import { readFileSync, writeFileSync } from 'node:fs'

const REPO = 'https://github.com/AlexGalhardo/nuxtjs-marketplace'
const bump = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bump ?? '')) {
	console.error('usage: bun run release <patch|minor|major>')
	process.exit(1)
}

const run = (...cmd: string[]): string => {
	const result = Bun.spawnSync(cmd, { stderr: 'inherit' })
	if (!result.success) process.exit(result.exitCode || 1)
	return result.stdout.toString().trim()
}

if (run('git', 'status', '--porcelain')) {
	console.error('working tree is not clean; commit or stash first')
	process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
const [major, minor, patch] = pkg.version.split('.').map(Number) as [number, number, number]
const next =
	bump === 'major'
		? `${major + 1}.0.0`
		: bump === 'minor'
			? `${major}.${minor + 1}.0`
			: `${major}.${minor}.${patch + 1}`

const changelog = readFileSync('CHANGELOG.md', 'utf8')
const unreleased = changelog.match(/## \[Unreleased\]\n([\s\S]*?)(?=\n## \[)/)
if (!unreleased?.[1]?.trim()) {
	console.error('CHANGELOG.md has nothing under [Unreleased]')
	process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
const updated = changelog
	.replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${next}] - ${today}\n`)
	.replace(
		/^\[Unreleased\]: .*$/m,
		`[Unreleased]: ${REPO}/compare/v${next}...HEAD\n[${next}]: ${REPO}/compare/v${pkg.version}...v${next}`,
	)
writeFileSync('CHANGELOG.md', updated)

const pkgText = readFileSync('package.json', 'utf8')
writeFileSync(
	'package.json',
	pkgText.replace(`"version": "${pkg.version}"`, `"version": "${next}"`),
)

run('git', 'add', 'CHANGELOG.md', 'package.json')
run('git', 'commit', '-m', `chore(release): v${next}`)
run('git', 'tag', '-a', `v${next}`, '-m', `v${next}`)
console.log(`v${next} committed and tagged. Push with: git push --follow-tags`)
