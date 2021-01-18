const ignoreLabels = ['run_to_wait_for_power_on_fail', 'init_no_signal', 'pgm_start', 'wait_for_power_on']

const $ = q => document.querySelector(q)

function html (html) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()

  return template.content.firstChild
}

function nonOverlapPartition (list) {
  list.sort((a, b) => a.start - b.start)

  const groups = []
  const max = []

  for (const c of list) {
    let done = false
    for (let i = 0; i < groups.length; i++) {
      if (c.start > max[i]) {
        groups[i].push(c)
        if (c.end > max[i]) {
          max[i] = c.end
        }
        done = true
        break
      }
    }

    if (!done) {
      groups.push([c])
      max.push(c.end)
    }
  }

  return groups
}

function parse (asm) {
  const lines = asm.split('\n')

  const labels = {}
  const jumps = []
  const jumpLabels = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const m = /(^[^\s;]+):/.exec(line)
    if (m) {
      const label = m[1]
      labels[label] = i
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    let jumpLabel = null

    let m = /(^(jn?(c|z)|(l|a|s)?jmp|ljc)\s+([^\s;]+))/.exec(line)
    if (m != null) {
      jumpLabel = m[5]
    } else {
      m = /(^(djnz|jn?b)\s+\S+\s*,\s*([^\s;]+))/.exec(line)
      if (m != null) {
        jumpLabel = m[3]
      } else {
        m = /(^cjne\s+\S+\s*,\s*\S+\s*,\s*([^\s;]+))/.exec(line)
        if (m != null) {
          jumpLabel = m[2]
        }
      }
    }

    if (jumpLabel) {
      jumpLabels.push(jumpLabel)
      if (labels[jumpLabel] && !ignoreLabels.includes(jumpLabel)) {
        jumps.push(i > labels[jumpLabel]
          ? { start: labels[jumpLabel], end: i }
          : { start: i, end: labels[jumpLabel] })
      } else {
        console[ignoreLabels.includes(jumpLabel) ? 'info' : 'warn'](`Ignoring label: ${jumpLabel} at line ${i}`)
      }
    }
  }

  const partJumps = nonOverlapPartition(jumps)

  const table = html('<table></table>')

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l]
    let tds = ''
    for (let i = 0; i < partJumps.length; i++) {
      tds += '<td></td>'
    }

    const code = line.indexOf(';') !== -1 ? line.substring(0, line.indexOf(';')) : line
    const comment = line.indexOf(';') !== -1 ? line.substring(line.indexOf(';')) : ''

    const row = html(`<tr><td style="text-align:right">${l + 1}</td>${tds}<td><span>${code}</span><span style="color:grey">${comment}</span></td></tr>`)
    table.appendChild(row)
  }

  const colors = ['red', 'blue', 'green', 'magenta', 'cyan', 'orange', 'brown', 'lime', 'purple']

  const rows = table.children

  for (let p = 0; p < partJumps.length; p++) {
    const jump = partJumps[p]

    for (let i = 0; i < rows.length; i++) {
      for (const range of jump) {
        if (i >= range.start && i <= range.end) {
          const color = colors[p % colors.length]
          let border = ''
          if (i === range.start || i === range.end) {
            rows[i].children[1 + partJumps.length].children[0].setAttribute('style', `text-decoration: underline 2px ${color};`)
            // separate back to back lines
            border = `border-${i === range.start ? 'top' : 'bottom'}:9px solid white`
          }

          rows[i].children[1 + (partJumps.length - p - 1)].setAttribute('style', `background:${color};${border};`)
          break
        }
      }
    }
  }

  $('#container').appendChild(table)

  // unreferenced labels
  // TODO: handle calls and memory locations
  // const unref = Object.keys(labels).filter(l => !jumpLabels.includes(l))
  // console.log(unref)
}

window.fetch('code.asm')
  .then(res => res.ok ? res.text() : Promise.reject(res.statusText))
  .then(parse)
