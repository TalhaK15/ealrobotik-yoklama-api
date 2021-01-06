const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const fs = require("fs")
const date = new Date()
const app = express()
const port = process.env.PORT || 3000

let user_info_regex = / ?(\||-|_) ?/gm

let userName
let userNumber
let userClass

let joinedParticipant
let leftParticipant
let participant
let reportIndex
let newReport
let userInfo

let clearVariables = () => {
  userInfo = null
  userName = null
  joinedParticipant = null
  leftParticipant = null
  participant = null
  reportIndex = null
  newReport = null
}

let all
let data
let dataFileName = `data/${date.toISOString().slice(0, 10)}.json`

console.log(dataFileName)

/* if (!fs.existsSync(dataFileName)) {
  fs.writeFileSync(dataFileName, "")
} else {
  data = JSON.parse(fs.readFileSync(dataFileName))
} */

// Where we will keep participants
let participants = data?.participants || []
let report_per_participant = data?.report_per_participant || []

let findParticipant = (where, what) => {
  return where.map((w) => w.id).indexOf(what)
}

app.use(cors())

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.post("/join", (req, res) => {
  all = req.body
  joinedParticipant = req.body.payload.object.participant
  participants.push(joinedParticipant)
  res.send(participants)
  clearVariables()
})

app.post("/left", (req, res) => {
  all = req.body
  leftParticipant = req.body.payload.object.participant
  joinedParticipant =
    participants[findParticipant(participants, leftParticipant.id)]
  reportIndex = findParticipant(report_per_participant, leftParticipant.id)
  newReport = {
    join_time: joinedParticipant.join_time,
    leave_time: leftParticipant.leave_time,
  }

  if (reportIndex > -1) {
    report_per_participant[reportIndex].report_time.push(newReport)
  } else {
    userInfo = leftParticipant.user_name.replaceAll(user_info_regex, " ").split(" ")
    userName = userInfo.slice(2, userInfo.length).join(" ")

    participant = {
      user_name: userName,
      user_number: userInfo[1],
      user_class: userInfo[0],
      id: leftParticipant.id,
      report_time: [newReport],
    }

    report_per_participant.push(participant)
  }

  participants.splice(findParticipant(participants, leftParticipant.id), 1)
  res.send([participants, report_per_participant, data])
  clearVariables()
})

app.get("/status", (req, res) => {
  res.send(all)
  clearVariables()
})

app.listen(port, () => console.log(`App listening on port ${port}!`))
