
/*const DB_HELPER_JS_NAME = "ThinkMineDBHelper.js";
const THINK_MINE_MAIN_PAGE_NAME = "ThinkMine_MainPage_DEV.html";
const THINK_MINE_MIND_MAP_PAGE_NAME = "ThinkMine_MindMapPage_DEV.html";*/

const spaceDelimiter = " ";
const nullCharDelimiter = "\0";
const tcpSocketIdDelimiter = "/";
const nullCharValue = 0;

var mainPage = process.argv[2];
var RDWrapperChildServers = new Array();


var HashMap = require('hashmap').HashMap;
var roomInfoHashMap = new HashMap();

var http = require('http');
var fs = require('fs');
var socketio = require('socket.io');
var net = require('net');

//For Debug
//setInterval(function(){ console.log(RDWrapperChildServers); console.log(roomInfoHashMap); }, 500);


/*var childProcessModule = require('child_process');
var dbHelperProcess = childProcessModule.fork(__dirname + '/'+DB_HELPER_JS_NAME);*/

var SocketIORoutingServer = net.createServer(function(conn){
	console.log("RDWrapper Child Server Connected : " + conn.remoteAddress);
	console.log(conn.localPort);
	
	conn.on('end', function() {
		for(var j=0; j < RDWrapperChildServers.length; j++){
			if(RDWrapperChildServers[j].id == conn.id){
				for(k=0; k<RDWrapperChildServers[j].roomList.length; k++){
					roomInfoHashMap.remove(RDWrapperChildServers[j].roomList[k]);
				}
				RDWrapperChildServers.splice(j,1);
				break;
			}
		}
	});
	
	conn.on('data',function(data){
	
		var dataArray = data.toString().split(nullCharDelimiter);

		for(var i=0; i<dataArray.length; i++){
		
			var flagValue = dataArray[i][0];

			switch (flagValue) {
			case "#":
				var infoArray = dataArray[i].split(spaceDelimiter);
				var webSocketPort = infoArray[1];
				var tcpSocketPort = infoArray[2];
				
				var idValue = ""
								+ conn.localAddress + tcpSocketIdDelimiter
								+ conn.localPort + tcpSocketIdDelimiter
								+ conn.remoteAddress + tcpSocketIdDelimiter
								+ conn.remotePort;
								
				conn.id = idValue;
				 
				var newRDWrapperChildServer = {
								remoteAddress : conn.remoteAddress,
								remotePort : conn.remotePort,
								localAddress : conn.localAddress,
								localPort : conn.localPort,
								id : idValue,
								webSocketPort : webSocketPort,
								tcpSocketPort : tcpSocketPort,
								roomCount : 0,
								roomList : [],								
								clientCount : 0
							};
		
				RDWrapperChildServers.push(newRDWrapperChildServer);
				
				console.log("Child Server ("+conn.remoteAddress+") has started SocketIo Server on port : " + webSocketPort +", TCP Server on port : " + tcpSocketPort);
				
				conn.write("# 1"+nullCharDelimiter);
				
				break;
			case "0":
				var infoArray = dataArray[i].split(spaceDelimiter);
				var isFromTcpSocket = Number(infoArray[1]);
				var roomName = infoArray[2];
				var userId = infoArray[3];
				var clientId = infoArray[4];
				var portNumber = infoArray[5];
				var retryCount = infoArray[6];
				var retInfo = null;
				//To handle race condition
				
				var serverAddr = conn.remoteAddress;
				var serverPort = portNumber;
				
				var targetChildServer = null;
				
				if(!roomInfoHashMap.has(roomName)){
				
					for(var j=0; j<RDWrapperChildServers.length; j++){
						console.log(RDWrapperChildServers[j].remoteAddress);
						console.log(serverAddr);
						console.log(RDWrapperChildServers[j].webSocketPort);
						console.log(RDWrapperChildServers[j].tcpSocketPort);
						console.log(serverPort);
						if(RDWrapperChildServers[j].remoteAddress == serverAddr
							&& ((!isFromTcpSocket && RDWrapperChildServers[j].webSocketPort == serverPort)
							 || (isFromTcpSocket && RDWrapperChildServers[j].tcpSocketPort == serverPort))){
								targetChildServer = RDWrapperChildServers[j];
								break;
							}
					}				

					roomInfoHashMap.set(roomName,targetChildServer);
					
					targetChildServer.roomCount++;
					targetChildServer.roomList.push(roomName);

								
					
					retInfo = "00 "+ isFromTcpSocket + " " +conn.remoteAddress + " " + portNumber  + " " + roomName + " " + clientId + " " + userId + " " + retryCount+nullCharDelimiter;
				}
				else{
					var roomInfo = roomInfoHashMap.get(roomName);
					retInfo = "01 "+ isFromTcpSocket + " " +roomInfo.addr + " " + roomInfo.port + " " +roomName + " " + clientId + " " + retryCount+nullCharDelimiter;
				}
				conn.write(retInfo);
				console.log(retInfo);

				break;
			case "1":
				var infoArray = dataArray[i].split(spaceDelimiter);
				var roomName = infoArray[1];
				var retInfo = null;
				var serverInfo = roomInfoHashMap.get(roomName);
				
				var serverAddr = serverInfo.address;
				var webSocketServerPort = serverInfo.webSocketPort;
				var tcpSocketServerPort = serverInfo.tcpSocketPort;
				
				roomInfoHashMap.remove(roomName);
				
				for(var j=0; j < RDWrapperChildServers.length; j++){
					if(RDWrapperChildServers[j].remoteAddress == serverAddr && RDWrapperChildServers[j].webSocketPort == webSocketServerPort){
						RDWrapperChildServers[j].roomCount--;
						for(k=0; k< RDWrapperChildServers[j].roomList.length; k++){
							if(RDWrapperChildServers[j].roomList[k] == roomName){
								RDWrapperChildServers[j].roomList.splice(k,1);
								break;
							}
						}
						break;
					}
				}
				
				
				break;
			}
		}
		/*if(data == 1)
			//Server Address Send
			;
		else{
			console.log(data);
		}*/
	});	
	
	conn.on('error', function(err) {
		console.log('error');
		//Need to handle error event
	});
	conn.on('close', function(data) {
		for(var j=0; j < RDWrapperChildServers.length; j++){
			if(RDWrapperChildServers[j].id == conn.id){
				for(k=0; k<RDWrapperChildServers[j].roomList.length; k++){
					roomInfoHashMap.remove(RDWrapperChildServers[j].roomList[k]);
				}
				RDWrapperChildServers.splice(j,1);
				break;
			}
		}
		//Need to handle close event
		
		console.log(conn);
		console.log('close');
	});
});

SocketIORoutingServer.listen(52272,function(err){
	console.log("Internal Communication Server Bound to 52272 port");
});
//console.log(test);


var express = require('express');
var app = express();
app.use(express.static(__dirname+'/js'));
app.use(express.static(__dirname+'/res'));
app.use(express.static(__dirname));
app.use(express.static(__dirname+'/res_usr'));
/*app.use(function (request,response) {
	fs.readFile(__dirname + '/'+THINK_MINE_MIND_MAP_PAGE_NAME, function (error,data){
		response.writeHead(200,{'Content-Type' : 'text/html'});
		response.end(data);
	});
});*/



var RoutingServer_SocketIO = http.createServer(app);
RoutingServer_SocketIO.listen(52274,function(){
	console.log("Routing SocketIO Server running at http://127.0.0.1:52274");	
});

var RoutingServerIo = socketio.listen(RoutingServer_SocketIO,{log:false});
RoutingServerIo.set('log level',1);



RoutingServerIo.sockets.on('connection', function (socket){
	
	socket.on('AddrPortReq',function(data){
		
			
		if(!roomInfoHashMap.has(data)){
			var minRoomCount = 99999999;
			var minIndex = -1
			for(var i=0; i < RDWrapperChildServers.length; i++){
				if(RDWrapperChildServers[i].roomCount < minRoomCount){
					minRoomCount = RDWrapperChildServers[i].roomCount;
					minIndex = i;
				}
			}
			/*var socketIoServerInfo = {retAddr : childSocketIOServers[i].address,
										status : 0};*/
			//roomInfoHashMap.set(data,socketIoServerInfo);
			//childSocketIOServers[minIndex].roomCount++;
			if(minIndex != -1){
				var retObj = {
								addr : RDWrapperChildServers[minIndex].remoteAddress,
								port : RDWrapperChildServers[minIndex].webSocketPort,
								roomName : data
							};
				
							

				RoutingServerIo.sockets.sockets[socket.id].emit('AddrPortRet',retObj);
			}
			//socket.emit(socketIoServerInfo);
			
		}
		else{
			var roomInfo = roomInfoHashMap.get(data);
			console.log("Entry exsist ");
			console.log(roomInfo);
			
			var retObj = {
				addr : roomInfo.remoteAddress,
				port : roomInfo.webSocketPort,
				roomName : data
			};
			
			RoutingServerIo.sockets.sockets[socket.id].emit('AddrPortRet',retObj);
			console.log(retObj);
			//socket.write(socketIoServerInfo);
		}
	});
});

var tcpStreamData = "";

var RoutingServer_TCP = net.createServer(function(conn){
		
	conn.on('end', function() {

	});
	
	conn.on('data',function(data){
		//console.log(data.toString());
		//console.log(data[data.length-1]);
		//console.log(nullCharDelimiter);
		console.log(data[data.length-1]);
		if(data[data.length-1] == nullCharValue){
			tcpStreamData += data;
			tcpStreamData.slice(data.length-1,data.length-1);
			console.log("data complete");
			console.log(tcpStreamData);
			
			
			var infoArray = tcpStreamData.split(spaceDelimiter);
			var flagValue = infoArray[0];
			
			tcpStreamData = "";
			
			switch (flagValue){
			case "AddrPortReq" : 
				
				var roomName = infoArray[1];
				
				if(!roomInfoHashMap.has(roomName)){
					var minRoomCount = 99999999;
					var minIndex = -1
					for(var i=0; i < RDWrapperChildServers.length; i++){
						if(RDWrapperChildServers[i].roomCount < minRoomCount){
							minRoomCount = RDWrapperChildServers[i].roomCount;
							minIndex = i;
						}
					}
					/*var socketIoServerInfo = {retAddr : childSocketIOServers[i].address,
												status : 0};*/
					//roomInfoHashMap.set(data,socketIoServerInfo);
					//childSocketIOServers[minIndex].roomCount++;
					
					var retString = "AddrPortRet" + " " +
									RDWrapperChildServers[minIndex].remoteAddress + " " +
									RDWrapperChildServers[minIndex].tcpSocketPort + " " +
									roomName + " " + nullCharDelimiter;
							
								
					console.log(retString);
					
					conn.write(retString);

					
				}
				else{
					var roomInfo = roomInfoHashMap.get(roomName);
					console.log("Entry exsist ");
					console.log(roomInfo);
					
					var retString = "AddrPortRet" + " " +
									roomInfo.addr + " " +
									roomInfo.tcpSocketPort + " " +
									roomName + " " + nullCharDelimiter;
					
					console.log(retString);
					
					conn.write(retString);
				}
			
				break;
			}
		}
		else{
			tcpStreamData += data;
			console.log("add : " + tcpStreamData);
		}	
	});	
	
	conn.on('error', function(err) {
		console.log('error');
		if (e.code == 'EADDRINUSE') {
			console.log("You cannot use the port (" + tcpSocketPortNumber+") for TCPsocket, It's being used by other process");
			process.exit(1);

		}
	});
	conn.on('close', function(data) {
		
		//Need to handle close event
		
		console.log(conn);
		console.log('close');
	});
});

RoutingServer_TCP.listen(52275,function(err){
	console.log("Routing TCP Server running at http://127.0.0.1:52275");	
});





