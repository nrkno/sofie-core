// Fix fibers implementation, so it runs with Jest:

const fs = require('fs')

const filePath = './node_modules/fibers-npm/fibers.js'

const stringToInsert = '\t\tif (process.env.JEST_WORKER_ID !== undefined ) modPath += \'.node\''
const insertLineNumber = 13

const lines = fs.readFileSync(filePath).toString().split('\n')

// Insert line:
if (lines[insertLineNumber].trim() !== stringToInsert.trim() ) {
    console.log(`Inserting Jest-fix line into ${filePath}`)
    lines.splice(insertLineNumber, 0, stringToInsert)
}
const text = lines.join('\n')

fs.writeFile(filePath, text, function (err) {
  if (err) return console.log(err)
})
