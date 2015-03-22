const SOCKET_TYPE = {web : 0,
					tcp : 1
					};
					
const OPERATION_TYPE = {CREATE : 0,
						READ : 1,
						UPDATE : 2,
						DELETE : 3
						};

const spaceDelimiter = " ";
const nullCharDelimiter = "\0";
const tcpSocketIdDelimiter = "/";
const nullCharValue = 0;


const ROUTING_SERVER_ADDRESS = "127.0.0.1";
const ROUTING_SERVER_PORT = 52272;



var webSocketPortNumber = -1;
var tcpSocketPortNumber = -1;
var module_path = null;

var imported_module = null;


var tcpStreamData = "";

//Base on CRUD Operations
//Each operation should return value as {suc : 0/1 , mes : [some value]}
var operations = function (){
	this.Create = null;
	this.Read = null;
	this.Update = null;
	this.Delete = null;
	//this.StoreBack = null;
};



if(process.argv.length != 5){
	console.log("Usage - node RDWrapper_ChildServer.js [WebSocket port] [TCP port] [delegate module Path]");
	process.exit(1);
}
else{	
	if(!isInteger(Number(process.argv[2])) || !isInteger(Number(process.argv[3]))){
		console.log("You should give Integer value for port");
		process.exit(1);
	}
	webSocketPortNumber = Number(process.argv[2]);
	tcpSocketPortNumber = Number(process.argv[3]);
}


var module_path = process.argv[4];
imported_module = require(module_path);

if(imported_module == null){
	console.log("Failed to load module - " + module_path +", Please check path of the module ");
	process.exit(1);
}

if(!map_operations(imported_module)){
	console.log("Failed to map operations, please check implementation of your own module");
}


var http = require('http');
var socketio = require('socket.io');
var net = require('net');
var express = require('express');

var HashMap = require('hashmap').HashMap;

var room_Clients_Hashmap = new HashMap();

var app = express();
var RoomServer_SocketIO = http.createServer(app);
var RoomServer_TCP = null;
var RoomSocketIo = null;
var RoomTcp_Hashmap = new HashMap();

var InternalCommunicationSocket = net.connect(ROUTING_SERVER_PORT, ROUTING_SERVER_ADDRESS, function(){
	console.log("Routing Server Connected");
	console.log("Create SocketIO Server and send Information through internal socket");
	

	var webSocketListenResult = RoomServer_SocketIO.listen(webSocketPortNumber,function(){
		console.log("Actual Room SocketIO Server running at http://127.0.0.1:"+webSocketPortNumber);	
		
		
		RoomSocketIo = socketio.listen(RoomServer_SocketIO,{log:false});
		RoomSocketIo.set('log level',1);

		RoomSocketIo.sockets.on('connection', function (socket){
			socket.on('JoinReq',function(data){
				
				var isRoomFound = room_Clients_Hashmap.has(data.roomName);
				
				if(isRoomFound){
					RoomSocketIo.sockets.sockets[socket.id].join(""+data.roomName);
					
					var roomObj = room_Clients_Hashmap.get(data.roomName);
					
					var clientArr = roomObj.totalClients;
					clientArr.push({userId : data.userId,
										socketType : SOCKET_TYPE.web,
										socketObj : socket
									});
					var webSocketArr = roomObj.webSocketClients;
					webSocketArr.push(socket);
					
					var tcpSocketArr = roomObj.tcpSocketClients;
					
					if(socket.rooms == undefined)
						socket.rooms = [];
					socket.rooms.push(data.roomName);
					
					var finalResponseData = {
												approval : true,
												roomName : data.roomName,
												userId : data.userId												
											};
					
					RoomSocketIo.sockets.in(data.roomName).emit("JoinRet",finalResponseData);
					
					for(var i=0; i<tcpSocketArr.length; i++){
					
						finalResponseData = "JoinRet "
											+"1 "
											+data.roomName + " "
											+data.userId 											
											+nullCharDelimiter;		
											
						tcpSocketArr[i].write(finalResponseData);
					}
				}
				else{
					var sendData = "0 0 "+data.roomName+" "+data.userId+" " + socket.id + " " + webSocketPortNumber + " " + data.retryCount+ nullCharDelimiter;
					//Request Type
					//Socket Type
					//Socket Id Value
					//Port Value
					//Retry Count
					console.log(data);
					console.log(sendData);
					InternalCommunicationSocket.write(sendData);
				}
					
			});
			
			socket.on('SRInfo',function(data){
				var roomObj = room_Clients_Hashmap.get(data);
				console.log("roomObj" + roomObj);
				//Error Handling for fail condition of finding entity...
				if(roomObj == null || roomObj == undefined)
					return;
				
				var srInfo = [];
				for(var i=0; i<roomObj.totalClients.length; i++){
					srInfo.push(roomObj.totalClients[i].userId);
				}
				console.log("srInfo : " + srInfo);
				socket.emit('SRInfo',srInfo);
			});
			
			socket.on('BroadCastM',function(data){
				
				var res = callCRUDOperaton(data.m, data.t);
				
				if(res.suc == 0){
					console.log(res.mes);
					return;
				}
				
				data.m = res.ret;
			
				socket.broadcast.to(data.r).emit("RoomMessage",data);
				var roomObj = room_Clients_Hashmap.get(data.r);
				/*var rm = "RoomMessage" + spaceDelimiter
					+ data.r + spaceDelimiter
					+ data.fu + spaceDelimiter
					+ JSON.stringify(data.m) + spaceDelimiter
					+ data.t 
					+ nullCharDelimiter;*/
				var rm = "RoomMessage" + spaceDelimiter 
						+ JSON.stringify(data)
						+ nullCharDelimiter;
				for(var i=0; i< roomObj.tcpSocketClients.length; i++){
					roomObj.tcpSocketClients[i].write(rm);
				}
							
			});


			socket.on('PublicM',function(data){
			
				var res = callCRUDOperaton(data.m, data.t);
				
				if(res.suc == 0){
					console.log(res.mes);
					return;
				}
				
				data.m = res.ret;
				
				RoomSocketIo.sockets.in(data.r).emit("RoomMessage",data);
				
				socket.broadcast.emit("RoomMessage",data);
				var roomObj = room_Clients_Hashmap.get(data.r);
				/*var rm = "RoomMessage" + spaceDelimiter
					+ data.r + spaceDelimiter
					+ data.fu + spaceDelimiter
					+ JSON.stringify(data.m) + spaceDelimiter
					+ data.t 
					+ nullCharDelimiter;*/
				var rm = "RoomMessage" + spaceDelimiter 
						+ JSON.stringify(data)
						+ nullCharDelimiter;
				for(var i=0; i< roomObj.tcpSocketClients.length; i++){
					roomObj.tcpSocketClients[i].write(rm);
				}
				
				
			});			
 
			
			socket.on('PrivateM',function(data){
			
				var res = callCRUDOperaton(data.m, data.t);
				
				if(res.suc == 0){
					console.log(res.mes);
					return;
				}
				
				data.m = res.ret;
			
				var roomObj = room_Clients_Hashmap.get(data.r);
				var toUserInfo = null;

				for(var i=0; i< roomObj.tcpSocketClients.length; i++){
					if(roomObj.tcpSocketClients[i].userId == data.tu){
						toUserInfo = roomObj.tcpSocketClients[i];
						
						if(toUserInfo.socketType == SOCKET_TYPE.web){
							toUserInfo.socketObj.emit("RoomMessage",data);
						}
						else{
							/*var rm = "RoomMessage" + spaceDelimiter
									+ data.r + spaceDelimiter
									+ data.fu + spaceDelimiter
									+ data.tu + spaceDelimiter
									+ JSON.stringify(data.m) + spaceDelimiter
									+ data.t 
									+ nullCharDelimiter;*/
							var rm = "RoomMessage" + spaceDelimiter 
									+ JSON.stringify(data)
									+ nullCharDelimiter;
							toUserInfo.socketObj.write(rm);
						}						
					}
				}
				
				
				
				
				
			});
			
			socket.on('PrivateSelfM',function(data){
				
				var res = callCRUDOperaton(data.m, data.t);
				
				if(res.suc == 0){
					console.log(res.mes);
					return;
				}
				socket.emit("RoomMessage", {r : data.r,										
							m : res.ret,
							t : data.t});
				/*if(data.t == OPERATION_TYPE.READ)
					// change to event Listener
					socket.emit("RoomMessage", {r : data.r,										
												m : res.mes,
												t : data.t});
				else{
					console.log("adsfjandlfjkn");
					console.log(res.mes);
					socket.emit("RoomMessage",{r : data.r,										
												m : res.mes,
												t : data.t});
					}*/
			});
			
			socket.on('leave',function(data){
				
				var leavingUser = "";
				
				socket.leave(""+data);
				//RoomSocketIo.sockets.sockets[socket.id].leave(""+data);
				console.log("data : " + data);
				for(var j=0; j<socket.rooms.length; j++){
					if(socket.rooms[j] == ""+data){
						socket.rooms.splice(j,1);
						break;
					}
				}
				
				var roomObj = room_Clients_Hashmap.get(data);
				
				var clientArr = roomObj.totalClients;
				
				
				for(var j=0; j<clientArr.length ; j++){					
					if(clientArr[j].socketObj == socket){						
						leavingUser = clientArr[j].userId;
						clientArr.splice(j,1);						
						break;
					}
				}
				
				var webSocketArr = roomObj.webSocketClients;
				
				for(var j=0; j<webSocketArr.length ; j++){
					if(webSocketArr[j] == socket){
						webSocketArr.splice(j,1);
						break;
					}
				}
				
				var tcpSocketArr = roomObj.tcpSocketClients;
				
				if(clientArr.length == 0){
					room_Clients_Hashmap.remove(data);
					
					var sendData = "1 " + data + nullCharDelimiter;
					InternalCommunicationSocket.write(sendData);
					console.log(sendData);
				}
				
				var leaveResponseData = {roomId : data,
										userId : leavingUser										
										};

				RoomSocketIo.sockets.in(data).emit("LeaveRet",leaveResponseData);
				
				for(var i=0; i<tcpSocketArr.length; i++){
				
					leaveResponseData = "LeaveRet "
										+data+ " "
										+leavingUser
										+nullCharDelimiter;		
										
					tcpSocketArr[i].write(leaveResponseData);
				}

				
			});	
			socket.on('disconnect',function(data){
				
				var rooms = socket.rooms;
				//To handle anonymous socket condition
				if(socket.rooms == undefined)
					return;
				var leavingUser = "";
				
				for(var i = 0; i < rooms.length; i++){
					var room = rooms[i];
					//room = room.substr(1,room.length-1); 

					
					socket.leave(room);
					
					var roomObj = room_Clients_Hashmap.get(room);
					
					var clientArr = roomObj.totalClients;
				
					for(var j=0; j<clientArr.length ; j++){			
						if(clientArr[j].socketObj == socket){
							leavingUser = clientArr[j].userId;
							clientArr.splice(j,1);							
							break;
						}
					}
					
					var webSocketArr = roomObj.webSocketClients;
			
					for(var j=0; j<webSocketArr.length ; j++){
						if(webSocketArr[j] == socket){
							webSocketArr.splice(j,1);
							break;
						}
					}
					
					if(clientArr.length == 0){
						room_Clients_Hashmap.remove(room);
						
						var sendData = "1 " + room + nullCharDelimiter;
						InternalCommunicationSocket.write(sendData);
						console.log(sendData);
					}
					
					var tcpSocketArr = roomObj.tcpSocketClients;
					
					
					var leaveResponseData = {roomId : room,
											userId : leavingUser										
											};

					RoomSocketIo.sockets.in(room).emit("LeaveRet",leaveResponseData);
					
					for(var i=0; i<tcpSocketArr.length; i++){
					
						leaveResponseData = "LeaveRet "
											+room+ " "
											+leavingUser
											+nullCharDelimiter;		
											
						tcpSocketArr[i].write(leaveResponseData);
					}
					
					
				}
				socket.rooms = [];				
			});
		});
		//InternalCommunicationSocket.write("# "+webSocketPortNumber+ nullCharDelimiter);
		
		RoomServer_TCP = net.createServer(function(conn){

			var tcpSocketId = ""
						+ conn.localAddress + tcpSocketIdDelimiter
						+ conn.localPort + tcpSocketIdDelimiter
						+ conn.remoteAddress + tcpSocketIdDelimiter
						+ conn.remotePort;
		
			RoomTcp_Hashmap.set(tcpSocketId, conn);
			
			conn.socketId = tcpSocketId;
			
			
			conn.on('end', function() {

			});
			
			conn.on('data',function(data){
				console.log(data.toString());
				if(data[data.length-1] == nullCharValue){
					
					tcpStreamData += data;
					tcpStreamData = tcpStreamData.slice(0,tcpStreamData.length-1);
					
					
					var infoArray = tcpStreamData.split(spaceDelimiter);
					var flagValue = infoArray[0];
					
					
					
					console.log("flag : " + flagValue);
					switch (flagValue){
					case "JoinReq" : 
						var roomName = infoArray[1];
						var userId = infoArray[2];
						var retryCount = infoArray[3];
						var isRoomFound = room_Clients_Hashmap.has(roomName);
						console.log(room_Clients_Hashmap);
						console.log(roomName + " is Found ? " + isRoomFound);
						var tcpSocketId = ""
											+ conn.localAddress + tcpSocketIdDelimiter
											+ conn.localPort + tcpSocketIdDelimiter
											+ conn.remoteAddress + tcpSocketIdDelimiter
											+ conn.remotePort;
						
						if(isRoomFound){
							
							
								
							var roomObj = room_Clients_Hashmap.get(roomName);
							
							var clientArr = roomObj.totalClients;
							clientArr.push({userId : userId,
											socketType : SOCKET_TYPE.tcp,
											socketObj : conn
											});
							console.log(clientArr);
							
							var tcpSocketArr = roomObj.tcpSocketClients;
							tcpSocketArr.push(conn);
							
							if(conn.rooms == undefined)
								conn.rooms = [];
							conn.rooms.push(roomName);
							
							var finalResponseData = {
														approval : true,
														roomName : roomName,
														userId : userId												
													};
							
							
							RoomSocketIo.sockets.in(roomName).emit("JoinRet",finalResponseData);
					
							for(var i=0; i<tcpSocketArr.length; i++){
							
								finalResponseData = "JoinRet "
													+"1 "
													+roomName + " "
													+userId 											
													+nullCharDelimiter;		
													
								tcpSocketArr[i].write(finalResponseData);
							}

						}
						else{
							var sendData = "0 1 "+roomName+" "+userId+" " + tcpSocketId + " " + tcpSocketPortNumber + " " + retryCount + nullCharDelimiter;
							//Request Type
							//Socket Type
							//Socket Id Value
							//Port Value
							//Retry Count

							InternalCommunicationSocket.write(sendData);
						}					
	
						break;
					case "leave" :
					
						var room = infoArray[1];
						var tcpSocketId = conn.socketId;
						var leavingUser = "";
				
						RoomTcp_Hashmap.remove(tcpSocketId);

						
						
						var roomObj = room_Clients_Hashmap.get(room);
						//RoomSocketIo.sockets.sockets[socket.id].leave(room);
						var clientArr = roomObj.totalClients;
						
						


					
						for(var j=0; j<clientArr.length ; j++){			
							if(clientArr[j].socketObj == conn){
								leavingUser = clientArr[j].userId;
								clientArr.splice(j,1);								
								break;
							}
						}
						
						var tcpSocketArr = roomObj.tcpSocketClients;
				
						for(var j=0; j<tcpSocketArr.length ; j++){
							if(tcpSocketArr[j] == conn){
								tcpSocketArr.splice(j,1);
								break;
							}
						}
						
						if(clientArr.length == 0){
							room_Clients_Hashmap.remove(room);
							
							var sendData = "1 " + room + nullCharDelimiter;
							InternalCommunicationSocket.write(sendData);
							console.log(sendData);
						}
						
						var leaveResponseData = {roomId : room,
												userId : leavingUser										
												};

						RoomSocketIo.sockets.in(room).emit("LeaveRet",leaveResponseData);
						
						for(var j=0; j<tcpSocketArr.length; j++){
						
							leaveResponseData = "LeaveRet "
												+room+ " "
												+leavingUser
												+nullCharDelimiter;		
												
							tcpSocketArr[j].write(leaveResponseData);
						}
						
				
						
						console.log('leave');
						break;
					
					case "SRInfo" :
						var roomId = infoArray[1];
						var roomObj = room_Clients_Hashmap.get(roomId);
						
						//Error Handling for fail condition of finding entity...
						if(roomObj == null || roomObj == undefined)
							break;
						
						
						var retInfo = "SRInfo";
						for(var i=0; i<roomObj.totalClients.length; i++){
							retInfo += " ";
							retInfo += roomObj.totalClients[i].userId;
						}
						console.log(retInfo);
						retInfo += nullCharDelimiter;
						conn.write(retInfo);
						break;
					case "BroadCastM" :
						var initJsonString = tcpStreamData.substring(tcpStreamData.indexOf(" "));
						var jMessage = JSON.parse(initJsonString);
						var roomId = jMessage.r;
						var fromUserId = jMessage.fu;
						var message = jMessage.m;
						var type = jMessage.t;
						
						var res = callCRUDOperaton(message, type);
						
						if(res.suc == 0){
							console.log(res.mes);
							return;
						}
						
						var rm = {r : roomId,
								fu : fromUserId,
								m : res.ret,
								t : Number(type)};
						
						RoomSocketIo.sockets.in(roomId).emit("RoomMessage",rm);
						
						var roomObj = room_Clients_Hashmap.get(roomId);
						
						
						rm = "RoomMessage" + spaceDelimiter
							+ JSON.stringify(rm)
							+ nullCharDelimiter;
							
						for(var i=0; i< roomObj.tcpSocketClients.length; i++){
							if(roomObj.tcpSocketClients[i] == conn)
								continue;
								
							roomObj.tcpSocketClients[i].write(rm);
						}					
					
						break;
					case "PublicM" :
						var initJsonString = tcpStreamData.substring(tcpStreamData.indexOf(" "));
						console.log(tcpStreamData);
						console.log(tcpStreamData.indexOf(" "));
						console.log(initJsonString);
						var jMessage = JSON.parse(initJsonString);
						var roomId = jMessage.r;
						var fromUserId = jMessage.fu;
						var message = jMessage.m;
						var type = jMessage.t;
						
						var res = callCRUDOperaton(message, type);
						
						if(res.suc == 0){
							console.log(res.mes);
							return;
						}
						
						var rm = {r : roomId,
								fu : fromUserId,
								m : res.ret,
								t : Number(type)};
						
						console.log(RoomSocketIo.sockets);
						console.log("aaa");
						console.log(RoomSocketIo.sockets.in("adsfaef"));
						
						//RoomSocketIo.sockets.in(roomId).emit("RoomMessage",rm);
						RoomSocketIo.sockets.in(roomId).emit("RoomMessage",rm);
						
						var roomObj = room_Clients_Hashmap.get(roomId);
						
						
						rm = "RoomMessage" + spaceDelimiter
							+ JSON.stringify(rm)
							+ nullCharDelimiter;
							
						for(var i=0; i< roomObj.tcpSocketClients.length; i++){
							roomObj.tcpSocketClients[i].write(rm);
						}						
						break;
					case "PrivateM" :
						var initJsonString = tcpStreamData.substring(tcpStreamData.indexOf(" "));
						var jMessage = JSON.parse(initJsonString);
						var roomId = jMessage.r;
						var fromUserId = jMessage.fu;
						var toUserId = jMessage.tu;
						var message = jMessage.m;
						var type = jMessage.t;
						
						var res = callCRUDOperaton(message, type);
						
						if(res.suc == 0){
							console.log(res.mes);
							return;
						}
						
						var roomObj = room_Clients_Hashmap.get(roomId);
						var toUserInfo = null;
						


						for(var i=0; i< roomObj.tcpSocketClients.length; i++){
							if(roomObj.tcpSocketClients[i].userId == toUserId){
								toUserInfo = roomObj.tcpSocketClients[i];

								var rm = {r : roomId,
										fu : fromUserId,
										tu : toUserId,
										m : res.ret,
										t : Number(type)};
								
								if(toUserInfo.socketType == SOCKET_TYPE.web){

									toUserInfo.socketObj.emit("RoomMessage",rm);
								}
								else{
									rm = "RoomMessage" + spaceDelimiter
										+ JSON.stringify(rm)
										+ nullCharDelimiter;
									toUserInfo.socketObj.write(rm);
								}						
							}
						}					
						
						break;
					case "PrivateSelfM" :
						var initJsonString = tcpStreamData.substring(tcpStreamData.indexOf(" "));
						var jMessage = JSON.parse(initJsonString);
						var roomId = jMessage.r;						
						var message = jMessage.m;
						var type = jMessage.t;
						
		
						var res = callCRUDOperaton(message, type);
						
						if(res.suc == 0){
							console.log(res.mes);
							return;
						}
						
						
						var newData = { r : roomId,
										m : res.ret,
										t : type
										};
										
						var rm = "RoomMessage" + spaceDelimiter
								JSON.stringify(newData)
								+ nullCharDelimiter;						
						
						conn.write(rm);
						

						
						

						
						break;						
					}
					
					tcpStreamData = "";
				}
				else{
					tcpStreamData += data;
				}	
			});	
			
			conn.on('error', function(err) {
				console.log('error');
				if (err.code == 'EADDRINUSE') {
					console.log("You cannot use the port (" + tcpSocketPortNumber+") for TCPsocket, It's being used by other process");
					process.exit(1);

				}
			});
			conn.on('close', function(data) {
				
				var tcpSocketId = conn.socketId;
				
				RoomTcp_Hashmap.remove(tcpSocketId);
				console.log(conn);
				console.log("RoomTcp_Hahspmap");
				console.log(RoomTcp_Hashmap);

				var rooms = conn.rooms;
				console.log(rooms);
				
				for(var i = 0; i < rooms.length; i++){
				
					var room = rooms[i];					
					var roomObj = room_Clients_Hashmap.get(room);
					var leavingUser = "";
					var clientArr = roomObj.totalClients;
					
						
					for(var j=0; j<clientArr.length ; j++){			
						if(clientArr[j].socketObj == conn){
							leavingUser = clientArr[j].userId;
							clientArr.splice(j,1);							
							break;
						}
					}
					
					var tcpSocketArr = roomObj.tcpSocketClients;
			
					for(var j=0; j<tcpSocketArr.length ; j++){
						if(tcpSocketArr[j] == conn){
							tcpSocketArr.splice(j,1);
							break;
						}
					}
					
					if(clientArr.length == 0){
						room_Clients_Hashmap.remove(room);
						
						var sendData = "1 " + room + nullCharDelimiter;
						InternalCommunicationSocket.write(sendData);
						console.log(sendData);
					}
					
					
					var leaveResponseData = {roomId : room,
											userId : leavingUser										
											};

					RoomSocketIo.sockets.in(room).emit("LeaveRet",leaveResponseData);
					
					for(var j=0; j<tcpSocketArr.length; j++){
					
						leaveResponseData = "LeaveRet "
											+room+ " "
											+leavingUser
											+nullCharDelimiter;		
											
						tcpSocketArr[j].write(leaveResponseData);
					}					
				}
				conn.rooms = [];					
			});
		});

		RoomServer_TCP.listen(tcpSocketPortNumber,function(){
			console.log("Actual Room TCP Server running at http://127.0.0.1:"+tcpSocketPortNumber);
			
			InternalCommunicationSocket.write("# "+ webSocketPortNumber + " " + tcpSocketPortNumber+ nullCharDelimiter);
		});
		
		
	});

	if(webSocketListenResult._connectionKey == undefined){
		console.log("You cannot use the port (" + webSocketPortNumber+") for Websocket, It's being used by other process");
		process.exit(1);
	}
	

	



	
});

InternalCommunicationSocket.on('data', function(data){
	
	var dataArray = data.toString().split(nullCharDelimiter);
	//console.log(data.toString());
	
	
	
	for(var i=0; i<dataArray.length; i++){
		
		
		var flagValue = dataArray[i][0];
		

		switch(flagValue){
		case "#":
			var infoArray = dataArray[i].split(spaceDelimiter);
			var resultRegi = infoArray[1];
			if(resultRegi == 1){
				console.log("Succeeded to register socketIO,TCP to Routing Server!!");				
			}
			else{
				console.log("Failed to register SocketIO, TCP Socket to Routing Server... exit process");
				process.exit(1);
			}
			break;
		case "0":
			var infoArray = dataArray[i].split(spaceDelimiter);
			var isFromTcpSocket = (infoArray[1] == "0") ? false : true;

			var serverAddr = infoArray[2];
			var serverPort = infoArray[3];
			var roomName = infoArray[4];
			var socketId = infoArray[5];
			var userId = infoArray[6];
			var retryCount = infoArray[7];
			
			if(dataArray[i][1] == "0"){
				if(!isFromTcpSocket)
					RoomSocketIo.sockets.sockets[socketId].join(""+roomName);
				
				var clientArr = [];
				var webSocketArr = [];
				var tcpSocketArr = [];
				var targetSocket;
				
				
				if(!isFromTcpSocket){
					targetSocket = RoomSocketIo.sockets.sockets[socketId];
					
					clientArr.push({userId : userId,
									socketType : SOCKET_TYPE.web,
									socketObj : targetSocket
									});	
					console.log(clientArr);
									
					webSocketArr.push(targetSocket);
					
					if(targetSocket.rooms == undefined)
						targetSocket.rooms = [];
					targetSocket.rooms.push(roomName);			

					
				}				
				else{
					targetSocket = RoomTcp_Hashmap.get(socketId); 
					
					clientArr.push({userId : userId,
									socketType : SOCKET_TYPE.tcp,
									socketObj : targetSocket
									});					
					tcpSocketArr.push(targetSocket);
					
					
					if(targetSocket.rooms == undefined)
						targetSocket.rooms = [];
					targetSocket.rooms.push(roomName);
					
				}
				
				room_Clients_Hashmap.set(roomName,{totalClients : clientArr,
													webSocketClients : webSocketArr,
													tcpSocketClients : tcpSocketArr
													});
				
				console.log(room_Clients_Hashmap);

				if(!isFromTcpSocket){
					var finalResponseData = {
								approval : true,
								roomName : roomName,
								userId : userId
							};
					console.log(finalResponseData);
					targetSocket.emit("JoinRet",finalResponseData);
					console.log(targetSocket);
				}
				else{
					var finalResponseData = "JoinRet "
											+"1 "
											+roomName + " "
											+userId
											+nullCharDelimiter;
					
					targetSocket.write(finalResponseData);
				}
			}
			else{
				if(!isFromTcpSocket){
					var responseData = {
											approval : false,
											newAddr : serverAddr,
											newPort : serverPort,
											roomName : roomName,
											retryCount : retryCount
										};
					
					RoomSocketIo.sockets.sockets[socketId].emit("JoinRet",responseData);	
				}
				else{
					var responseData = "JoinRet " + 
										"0 " +
										serverAddr + " " +
										serverPort + " " +
										roomName + " " +
										retryCount + nullCharDelimiter;
					RoomTcp_Hashmap.get(socketId).write(responseData);
				}
			}
			break;
		}
	}
});

//sockInternalCommunicationSocketet.write("abcdefg");





//Utility Functions



function isInteger(x) {
	return (typeof x === 'number') && (x % 1 === 0);
}

function map_operations (a_imported_module){
	//Need to implement parameter check
	if(a_imported_module == null){
		console.log("failed to map operations, imported_module is null");
		return false;
	}
	
	if((a_imported_module.Create == null)){
		console.log("failed to map operations, Create function is not implemented");
		return false;
	}
	if((a_imported_module.Read == null)){
		console.log("failed to map operations, Read function is not implemented");
		return false;
	}
	if((a_imported_module.Update == null)){
		console.log("failed to map operations, Update function is not implemented");
		return false;
	}
	if((a_imported_module.Delete == null)){
		console.log("failed to map operations, Delete function is not implemented");
		return false;
	}
	/*if((a_imported_module.StoreBack == null)){
		console.log("failed to map operations, StoreBack function is not implemented");
		return false;
	}*/
	
	operations.Create = a_imported_module.Create;
	operations.Read = a_imported_module.Read;
	operations.Update = a_imported_module.Update;
	operations.Delete = a_imported_module.Delete;
//	operations.StoreBack = a_imported_module.StoreBack;

	// Map operations
	return true;
}

var callCRUDOperaton = function(aMessage, aType){
	var result;
	switch(aType){
		case OPERATION_TYPE.CREATE :
			result = operations.Create(aMessage);
		break;
		case OPERATION_TYPE.READ :
			result = operations.Read(aMessage);
		break;		
		case OPERATION_TYPE.UPDATE :
			result = operations.Update(aMessage);
		break;
		case OPERATION_TYPE.DELETE :
			result = operations.Delete(aMessage);
		break;		
	}
	/*result  = { suc : 1,	
				mes : "test",
				}*/
	
	return result;
	
}






