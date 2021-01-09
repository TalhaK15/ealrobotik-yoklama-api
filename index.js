// npm packages
const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const fs = require("fs")
const { report } = require("process")

// consonants
const date = new Date()
const app = express()
const port = process.env.PORT || 3000
const memberList = JSON.parse(fs.readFileSync("data/constant/memberList.json"))

// variables

// Where we will keep our main data
let data = {
  participants: [],
  report_per_participant: [],
  report_meeting: {},
  report_polling: {},
}

let dataFileName
// data = JSON.parse(fs.readFileSync(dataFileName))

let user_info_regex = / ?(\||-|_) ?/gm

let userName

let joinedParticipant
let leftParticipant
let participant
let reportIndex
let newReport
let userInfo

// functions

//clear variables
let clearVariables = () => {
  userInfo = null
  userName = null
  joinedParticipant = null
  leftParticipant = null
  participant = null
  reportIndex = null
  newReport = null
  meetingInfo = null
}

// compare times (to find duration)
const timeDiff = (joinTime, leaveTime) => {
  joinTime = new Date(joinTime)
  leaveTime = new Date(leaveTime)
  let diff = Math.abs((leaveTime - joinTime) / 36e5)

  return diff * 60
}

// for find the participant who left from the meeting
let findParticipant = (where, what) => {
  return where.map((w) => w.id).indexOf(what)
}

// save our data object to a JSON file
const saveToDatabase = (dataFileName) => {
  fs.writeFileSync(dataFileName, JSON.stringify(data))
}

// main purpose of project, polling
const poll = () => {
  let attendedMembers = data.report_per_participant
  let notAttendedMembers = []
  let verifiedMemebers = []
  let declinedMembers = []
  let meetingDuration =
    data.report_meeting.duration ||
    timeDiff(
      data.report_meeting.start_time,
      new Date(new Date().toLocaleString("en")).toISOString()
    )

  // ------------------------------------------------------
  notAttendedMembers = memberList.filter((member) => {
    for (let i = 0; i < attendedMembers.length; i++) {
      console.log(attendedMembers[i].user_name, "----", member.user_name)
      if (attendedMembers[i].user_name == member.user_name) {
        console.log("false")
        return false
      } else {
        console.log("else")
        continue
      }
    }
    console.log("true")
    return true
  })

  notAttendedMembers.forEach((member) => {
    member.attendDuration = 0
    member.here = false
  })
  // ------------------------------------------------------

  attendedMembers.forEach((member) => {
    let attendDurationByMinute = 0
    member.report_time.forEach((report) => {
      attendDurationByMinute += timeDiff(report.join_time, report.leave_time)
    })

    member.attendDuration = attendDurationByMinute
    if (attendDurationByMinute >= (meetingDuration / 100) * 90) {
      member.here = true
      verifiedMemebers.push(member)
    } else {
      member.here = false
      declinedMembers.push(member)
    }
  })

  data.report_per_participant = attendedMembers
  data.report_polling.verified_members = verifiedMemebers
  data.report_polling.declined_members = declinedMembers
  data.report_polling.not_attended_members = notAttendedMembers
  data.report_polling.members = attendedMembers.concat(notAttendedMembers)

  saveToDatabase(dataFileName)
}

// set cors
app.use(cors())

// configuring body parser
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// API

// POST requests

// when the meeting started
app.post("/meeting_started", (req, res) => {
  // the meeting info that zoom sent us
  meetingInfo = req.body.payload.object

  dataFileName = `data/${meetingInfo.uuid}.json`

  // save mmeting info to an object
  data.report_meeting = {
    id: meetingInfo.uuid,
    topic: meetingInfo.topic,
    host_id: meetingInfo.host_id,
    start_time: meetingInfo.start_time,
    end_time: null,
    duration: null,
  }

  // end the query
  res.end()

  // save data to a JSON file and clear variables
  saveToDatabase(dataFileName)
  clearVariables()
})

// when the meeting ended
app.post("/meeting_ended", (req, res) => {
  // the meeting info that zoom sent us
  meetingInfo = req.body.payload.object

  // save mmeting end time and calculate the duration of meeting
  data.report_meeting.end_time = meetingInfo.end_time
  data.report_meeting.duration = timeDiff(
    meetingInfo.start_time,
    meetingInfo.end_time
  )

  // end the query
  res.end()

  // poll and clear variables
  poll()
  clearVariables()
})

// when a participant or host joined
app.post("/join", (req, res) => {
  // the participant info that zoom sent us
  joinedParticipant = req.body.payload.object.participant

  userInfo = joinedParticipant.user_name
    .replaceAll(user_info_regex, " ")
    .split(" ")
  userName = userInfo.slice(2, userInfo.length).join(" ")

  joinedParticipant = {
    id: joinedParticipant.id,
    user_name: userName,
    user_number: userInfo[1],
    user_class: userInfo[0],
    join_time: joinedParticipant.join_time,
  }

  // save new participant to our data object
  data.participants.push(joinedParticipant)

  // end the query
  res.end()

  // save data to a JSON file and clear variables
  saveToDatabase(dataFileName)
  clearVariables()
})

// when a participant or host left
app.post("/left", (req, res) => {
  // the participant info that zoom sent us
  leftParticipant = req.body.payload.object.participant

  //some variables to detect who is left and when was he/she join
  joinedParticipant =
    data.participants[findParticipant(data.participants, leftParticipant.id)]
  reportIndex = findParticipant(data.report_per_participant, leftParticipant.id)
  newReport = {
    join_time: joinedParticipant.join_time,
    leave_time: leftParticipant.leave_time,
  }

  // was he/she left this meeting before?
  if (reportIndex > -1) {
    // yes...
    data.report_per_participant[reportIndex].report_time.push(newReport)
  } else {
    // no...
    userInfo = leftParticipant.user_name
      .replaceAll(user_info_regex, " ")
      .split(" ")
    userName = userInfo.slice(2, userInfo.length).join(" ")

    participant = {
      user_name: userName,
      user_number: userInfo[1],
      user_class: userInfo[0],
      id: leftParticipant.id,
      report_time: [newReport],
    }

    // save his\her info to our data object
    data.report_per_participant.push(participant)
  }

  // remove him/her from participants list (in our data object)
  data.participants.splice(
    findParticipant(data.participants, leftParticipant.id),
    1
  )

  // end the query
  res.end()

  // save data to a JSON file and clear variables
  saveToDatabase(dataFileName)
  clearVariables()
})

//GET requests

// to get list of meetings
app.get("/meetings", (req, res) => {
  let meetings = []
  let meetingFiles = fs.readdirSync("data/")
  meetingFiles.splice(meetingFiles.indexOf("constant"), 1)

  meetingFiles.forEach((file) => {
    console.log(file)
    meetings.push(JSON.parse(fs.readFileSync(`data/${file}`)))
  })

  // send meetings as answer
  res.send(meetings)
})

// to learn meeting status
app.get("/all/:meetingId", (req, res) => {
  let meeting = JSON.parse(fs.readFileSync(`data/${req.params.meetingId}`))

  // send meeting object as answer
  res.send(meeting)
})

// to get participant list
app.get("/participants/:meetingId", (req, res) => {
  let meeting = JSON.parse(fs.readFileSync(`data/${req.params.meetingId}`))

  // send participant list as answer
  res.send(meeting.participants)
})

// to get per participant reports
app.get("/reportPerParticipant/:meetingId", (req, res) => {
  let meeting = JSON.parse(fs.readFileSync(`data/${req.params.meetingId}`))

  // send per participant reports as answer
  res.send(meeting.report_per_participant)
})

// to get meeting report
app.get("/reportMeeting/:meetingId", (req, res) => {
  let meeting = JSON.parse(fs.readFileSync(`data/${req.params.meetingId}`))

  // send meeting report as answer
  res.send(meeting.report_meeting)
})

// to get polling report
app.get("/reportPolling/:meetingId", (req, res) => {
  let meeting = JSON.parse(fs.readFileSync(`data/${req.params.meetingId}`))

  // send polling report as answer
  res.send(meeting.report_polling)
})

// to get member list
app.get("/memberList", (req, res) => {
  // send memberList as answer
  res.send(memberList)
})

// to poll
app.get("/poll", (req, res) => {
  if (!dataFileName) {
    poll()

    // send data.report_polling as answer
    res.send(data.report_polling)
  } else res.send([])
})

app.listen(port, () => console.log(`App listening on port ${port}!`))
