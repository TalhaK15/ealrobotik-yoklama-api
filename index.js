const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
// const fs = require("fs")
// const date = new Date()
const app = express()
const port = process.env.PORT || 3000

// let dataFileName = `data/${date.toISOString().slice(0, 10)}.json`
// console.log()

/* if(!fs.existsSync(dataFileName)) {
  fs.writeFileSync(dataFileName, "")
} else {

} */

// Where we will keep participants JSON.parse(fs.readFileSync("./data/participants.json")) ||
let participants = []

let findParticipant = (leftParticipant) => {
  return participants.map((p) => p.user_id).indexOf(leftParticipant.user_id)
}
let all
app.use(cors())

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.post("/join", (req, res) => {
  all = req.body
  let joinedParticipant = req.body.payload.object.participant
  participants.push(joinedParticipant)
  res.send(participants)
})

app.post("/left", (req, res) => {
  all = req.body
  let leftParticipant = req.body.payload.object.participant
  participants.splice(findParticipant(leftParticipant), 1)
  res.send(participants)
})

app.get("/status", (req, res) => {
  res.send(all)
})

app.listen(port, () => console.log(`App listening on port ${port}!`))
