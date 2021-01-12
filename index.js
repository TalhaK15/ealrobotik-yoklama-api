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
    Math.floor(
      timeDiff(
        data.report_meeting.start_time,
        new Date(new Date().toLocaleString("en")).toISOString()
      )
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
    meetings.push(JSON.parse(fs.readFileSync(`data/${file}`)).report_meeting)
  })

  // send meetings as answer
  res.send([
    {
      id: "333333",
      topic: "Meeting Topic 1",
      host_id: "uLoRgfbbTayCX6r2QQsQ",
      start_time: "2021-01-12T05:30:00Z",
      end_time: null,
      duration: null,
    },
    {
      id: "111111",
      topic: "Meeting Topic 2",
      host_id: "uLoRgfbbyCX6r2Q_qQsQ",
      start_time: "2021-01-06T08:00:00Z",
      end_time: "2021-01-06T09:00:00Z",
      duration: 60,
    },
    {
      id: "222222",
      topic: "Meeting Topic 3",
      host_id: "uLobbTayCX6r2Q_qQsQ",
      start_time: "2021-01-07T08:00:00Z",
      end_time: "2021-01-07T09:00:00Z",
      duration: 55,
    },
  ])
})

// to learn meeting status
app.get("/all/:meetingId", (req, res) => {
  let meeting = JSON.parse(fs.readFileSync(`data/${req.params.meetingId}`))

  // send meeting object as answer
  res.send(meeting)
})

// to get participant list
app.get("/participants", (req, res) => {
  // send participant list as answer
  res.send([
    {
      id: "ZHuwL745TyaVmJ5PsiFsIQ",
      user_name: "Talha Karasu",
      user_number: 136,
      user_class: "9/A",
      join_time: "2021-01-06T15:37:18Z",
    },
    {
      id: "Bkjgasd7GVBDi7ajl8H6qI",
      user_name: "Faruk Olusan",
      user_number: 358,
      user_class: "9/B",
      join_time: "2021-01-06T15:38:18Z",
    },
    {
      id: "Nhasdjn8Oaso8AHShndO8Q",
      user_name: "Bora Cetkin",
      user_number: 756,
      user_class: "9/C",
      join_time: "2021-01-06T15:39:18Z",
    },
  ])
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
  //let meeting = JSON.parse(fs.readFileSync(`data/${req.params.meetingId}`))

  // send polling report as answer
  res.send({
    verified_members: [
      {
        id: "222222222",
        user_name: "Engin Ege Es",
        user_number: 999,
        user_class: "9/B",
        report_time: [
          {
            join_time: "2021-01-06T08:01:00Z",
            leave_time: "2021-01-06T08:59:00Z",
          },
        ],
        attendDuration: 58,
        here: true,
      },
    ],
    declined_members: [
      {
        id: "111111111",
        user_name: "Talha Karasu",
        user_number: 136,
        user_class: "9/A",
        report_time: [
          {
            join_time: "2021-01-06T08:00:00Z",
            leave_time: "2021-01-06T08:05:00Z",
          },
          {
            join_time: "2021-01-06T08:07:00Z",
            leave_time: "2021-01-06T08:50:00Z",
          },
          {
            join_time: "2021-01-06T08:55:00Z",
            leave_time: "2021-01-06T09:00:00Z",
          },
        ],
        attendDuration: 53,
        here: false,
      },
    ],
    not_attended_members: [
      {
        user_name: "Ibrahim Karuc",
        user_number: 123,
        user_class: "9/C",
        id: "333333333",
        attendDuration: 0,
        here: false,
      },
    ],
    members: [
      {
        id: "222222222",
        user_name: "Engin Ege Es",
        user_number: 999,
        user_class: "9/A",
        report_time: [
          {
            join_time: "2021-01-06T08:01:00Z",
            leave_time: "2021-01-06T08:59:00Z",
          },
        ],
        attendDuration: 58,
        here: true,
      },
      {
        id: "111111111",
        user_name: "Talha Karasu",
        user_number: 136,
        user_class: "9/A",
        report_time: [
          {
            join_time: "2021-01-06T08:00:00Z",
            leave_time: "2021-01-06T08:05:00Z",
          },
          {
            join_time: "2021-01-06T08:07:00Z",
            leave_time: "2021-01-06T08:50:00Z",
          },
          {
            join_time: "2021-01-06T08:55:00Z",
            leave_time: "2021-01-06T09:00:00Z",
          },
        ],
        attendDuration: 53,
        here: false,
      },
      {
        id: "333333333",
        user_name: "Ibrahim Karuc",
        user_number: 123,
        user_class: "9/C",
        attendDuration: 0,
        here: false,
      },
    ],
  })
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
