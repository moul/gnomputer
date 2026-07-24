// Starter templates for the Editor app — small, hand-picked examples to
// begin a new script from rather than a blank file. Not fetched from
// anywhere community-run yet (that would need a place to actually publish
// and browse submissions, which doesn't exist); see docs/adr for how other
// "not there yet" gaps in this app are framed the same honest way.
export interface GnoTemplate {
  label: string;
  description: string;
  code: string;
}

export const GNO_TEMPLATES: GnoTemplate[] = [
  {
    label: "Hello, realm",
    description: "The smallest possible realm — just a Render() function.",
    code: `package hello

func Render(path string) string {
	return "# Hello, Gno!\\n\\nThis realm doesn't store any state yet."
}
`,
  },
  {
    label: "Counter",
    description: "A realm with mutable state and a function that changes it.",
    code: `package counter

import "strconv"

var count int

func Render(path string) string {
	return "# Counter\\n\\nCurrent value: **" + strconv.Itoa(count) + "**"
}

func Increment(cur realm) {
	count++
}

func Decrement(cur realm) {
	count--
}
`,
  },
  {
    label: "Package (p/)",
    description: "A pure library package — no state, no Render(), just exported functions and types.",
    code: `package mylib

// Add returns the sum of a and b.
func Add(a, b int) int {
	return a + b
}
`,
  },
];
