const ROUTING_SERVER_ADDR = "127.0.0.1";
const ROUTING_SERVER_ROOM_SOCKETIO_PORT = 52274;


const OPERATION_TYPE = {CREATE : 0,
						READ : 1,
						UPDATE : 2,
						DELETE : 3
						};

function addJavascript(jsname) {
	var th = document.getElementsByTagName('head')[0];
	var s = document.createElement('script');
	s.setAttribute('type','text/javascript');
	s.setAttribute('src',jsname);
	th.appendChild(s);
}

addJavascript("/socket.io/socket.io.js");

function Room(serverAddr, serverPort, userId){
	var RoutingSocketIO = null;
	var RoomSocketIo = null;
	var readyToCommuication = false;
	var roomId = null;
	var userId = userId;
	var sameRoomUsers = [];
	
	var routingServerAddr = serverAddr;
	var routingServerRoomSocketIoPort = serverPort;
	
	var connectToRoutingServer = function(){
		RoutingSocketIO = io.connect("http://" + routingServerAddr + ":" + routingServerRoomSocketIoPort,{'force new connection': true });
	}
	var disconnectFromRoutingServer = function(){
		RoutingSocketIO.disconnect();
		console.log(RoutingSocketIO);
	};
	
	var requestSameRoomUserInfo = function(){
		console.log("req srinfo");
		RoomSocketIo.emit("SRInfo",roomId);
	};
	
	this.joinRoom = function(roomName){
		connectToRoutingServer();
		
		var passingFunction = this.roomJoinedCallBack;
		var self = this;
		
		RoutingSocketIO.emit("AddrPortReq", roomName);
		
		
		RoutingSocketIO.on("AddrPortRet", function(data){
			disconnectFromRoutingServer();
			if(RoomSocketIo != null){
				RoomSocketIo.disconnect();
				RoomSocketIo = null;
				readyToCommuication = false;
				roomId = null;
			}
			console.log(data);
			RoomSocketIo = io.connect("http://" + data.addr + ":" + data.port,{'force new connection': true });
			//console.log(RoomSocketIo);
			//RoomSocketIo.socket.options.reconnect = false;

			
			var joinReqInfo = {
									roomName : data.roomName,
									userId : userId,
									retryCount : 0
								};
			console.log(RoomSocketIo);
			
			RoomSocketIo.on("JoinRet",function(data){
				if(!readyToCommuication){
					if(data.approval){
						readyToCommuication = true;
						roomId = data.roomName;
						requestSameRoomUserInfo();
						self.roomJoinedCallBack(data);
					}
					else{
						RoomSocketIo.disconnect();
						RoomSocketIo = null;
						readyToCommuication = false;
						roomId = null;
						
						if(data.retryCount > 30){
							console.log("Failed to connect to RoomSocketIo " +  data.newAddr + ":" + data.newPort + " / " + data.roomName + " (more than 30 times)");
							return;
						}
						
						RoomSocketIo = io.connect("http://" + data.newAddr + ":"+data.newPort);
						
						var retryJoinReqInfo = {
												roomName : data.roomName,
												userId : userId,
												retryCount : data.retryCount+1
											};
											
						RoomSocketIo.emit("JoinReq",retryJoinReqInfo);
					}
				}
				else{
					if(data.roomName == roomId){
						var isFound = false;
						for(var i=0; i< sameRoomUsers.length; i++){
							if(sameRoomUsers[i] == data.userId){
								isFound = true;
								break;
							}								
						}
						if(!isFound)
							sameRoomUsers.push(data.userId);
					}
					console.log("JoinUser : " + data.userId);
				}
			});
			
			RoomSocketIo.on("LeaveRet", function(data){

				if(data.roomId == roomId){
					for(var i=0; i< sameRoomUsers.length; i++){
						if(sameRoomUsers[i] == data.userId){
							sameRoomUsers.splice(i,1);
							break;
						}								
					}
				}
				console.log("Leaving User :" + data.userId);
			});
			RoomSocketIo.on("SRInfo", function(data){
				for(var i=0; i<data.length; i++){
					var isFound = false;
					for(var j=0; j< sameRoomUsers.length; j++){
						if(sameRoomUsers[j] == data[i]){
							isFound = true;
							break;
						}								
					}
					if(!isFound)
						sameRoomUsers.push(data[i]);
				}
				
				for(var i=0; i<sameRoomUsers.length; i++){
					console.log(sameRoomUsers[i]);
				}
			});			
			RoomSocketIo.on("RoomMessage", function(data){
				console.log("aaa");
				self.messageCallBack(data);
			});
			
			RoomSocketIo.emit("JoinReq",joinReqInfo);
		});
		

		
	};
	
	this.roomJoinedCallBack = function(data){
	};
	
	this.messageCallBack = function(message){
		console.log(message);
	};
	
	this.leaveRoom = function(){
		if(RoomSocketIo == null){
			console.log("There is no room to leave");
			return;
		}
		RoomSocketIo.emit("leave",roomId);
	};
	this.broadCastToCR = function(message,type){
		if(!readyToCommuication){
			console.log("You should establish room first!!");
			return;
		}
		RoomSocketIo.emit("BroadCastM", {r : roomId,
										fu : userId,
										m : message,
										t : type});
	};
	this.publicToCR = function(message,type){
		if(!readyToCommuication){
			console.log("You should establish room first!!");
			return;
		}
		RoomSocketIo.emit("PublicM", {r : roomId,
									fu : userId,
									m : message,
									t : type});
	};
	this.privateToSomeOne = function(toUserId, message, type){
		if(!readyToCommuication){
			console.log("You should establish room first!!");
			return;
		}
		if(toUserId == userId){
			console.log("You cannot send message your self, Please use privateToSelf function instead");
			return;
		}
		RoomSocketIo.emit("PrivateM", { r : roomId,
									fu : userId,
									tu : toUserId,										
									m : message,
									t : type});
	};
	this.privateToSelf = function(message, type){
		if(!readyToCommuication){
			console.log("You should establish room first!!");
			return;
		}
		RoomSocketIo.emit("PrivateSelfM", { r : roomId,										
											m : message,
											t : type});
	};
	
}