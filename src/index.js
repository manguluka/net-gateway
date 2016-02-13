import express from 'express'
import http from 'http'
import SerialPort from 'serialport'


const LinvoDB = require("linvodb3");
LinvoDB.defaults.store = { db: require("medeadown") }; 
LinvoDB.dbPath = process.cwd(); 
const Record = new LinvoDB("record", {})

const app = express()
const server = http.createServer(app)
const io = require('socket.io')(server)

const SerialDevice = process.env.SerialDevice || '/dev/cu.wchusbserial1410'
const ServerPort = process.env.ServerPort || 3333

const serialPort = new SerialPort.SerialPort(SerialDevice, {
    parser: SerialPort.parsers.readline('\r\n'),
    baudrate: 57600
}, false)

serialPort.open(error => {
    if (error) {
        console.log(`failed to open: ${ error }`)
    } else {
        console.log('open')
        serialPort.on('data', data => {
            // console.log(data)
            const splitData = data.split('|')
            if(splitData.length < 2){
                return
            }
            let msgType = splitData[0]
            let msgLabel = splitData[1]
            let msgPayload = splitData[2]
            let msgData 

            switch (msgLabel) {
                case "midi":
                    let splitPayload = msgPayload.split(',')
                    msgData = {
                        midiType: splitPayload[0],
                        number: splitPayload[1],
                        value: splitPayload[2],
                        channel: 0
                    }
                    break
                case "s":
                    let pattern = /({|,)?\s*'?([A-Za-z_$\.][A-Za-z0-9_ \-\.$]*)'?\s*:\s*/g
                    msgData = '{'+msgPayload+'}'
                    msgData = msgData.replace( pattern, function replacer(match,p1,p2){
                        return (p1 || '') + '"' + p2 + '":'
                    } )
                    msgData = JSON.parse(msgData)
                    console.log(msgData)
                    break
                default:
                    msgData = msgPayload
                    break
            }
            // console.log(msgType,msgLabel,msgPayload, msgData,data)
            Record.insert(
                {   
                    type: msgType,
                    label: msgLabel,
                    data: msgData,
                    raw:data
                },
                function (err, newDoc) {
                    console.log(err,newDoc._id);
                }
            );
            io.sockets.emit(msgLabel,msgData)
        })    
    }
})

server.listen(ServerPort)