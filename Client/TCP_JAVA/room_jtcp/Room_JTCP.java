package room_jtcp;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public abstract class Room_JTCP {
	
	private static final String SPACE_DELIMITER = " ";
	private static final String NULL_CHARACTER_DELIMITER = "\0";
	private static final byte NULL_CHARACTER_DELIMITER_BYTE 
									= NULL_CHARACTER_DELIMITER.getBytes()[0];
	
	private ExecutorService es;
	
	private boolean mRedayToCommunication;
	private String mRoutingSeverAddr;
	private int mRoutingSeverRoomTcpPort;
	private String roomId;
	private String userId;
	private ArrayList<String> sameRoomUsers;
	
	private Socket connectedRoutingServerSocket;
	private InputStream rin = null;
    private DataInputStream rdis = null;
	private OutputStream rout = null;
    private DataOutputStream rdos = null;
    
	private Socket connectedRoomServerSocket;
	private InputStream roomin = null;
    private DataInputStream roomdis = null;
	private OutputStream roomout = null;
    private DataOutputStream roomdos = null;
    
	
	
	public Room_JTCP(String aServerAddr, int aServerPort, String aUserId) {
		es = new ThreadPoolExecutor(10, 10, 1, TimeUnit.MINUTES, (BlockingQueue<Runnable>) new ArrayBlockingQueue<Runnable>(10, true));
		
		userId = aUserId;
		sameRoomUsers = new ArrayList<String>();
		
		mRedayToCommunication = false;
		mRoutingSeverAddr = aServerAddr;
		mRoutingSeverRoomTcpPort = aServerPort;		
		roomId = null;
		
		connectedRoutingServerSocket = null;
	}
	
	public abstract void connectionCallback();
	
	private boolean connectToRoutingServer() throws IOException{
		boolean isSucceedToConnect = true;
		try {
			connectedRoutingServerSocket = new Socket(mRoutingSeverAddr, mRoutingSeverRoomTcpPort);
			
			rin = connectedRoutingServerSocket.getInputStream();
			rdis = new DataInputStream(rin);
		
			rout = connectedRoutingServerSocket.getOutputStream();
			rdos = new DataOutputStream(rout);
			
		} catch (UnknownHostException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			isSucceedToConnect = false;
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			isSucceedToConnect = false;
		} catch (Exception e){
			e.printStackTrace();
			isSucceedToConnect = false;
		} finally{
			if(!isSucceedToConnect){
				mRedayToCommunication = false;
				roomId = null;
				
				if(rdis != null)
					rdis.close();
				if(rdos != null)
					rdos.close();
				if(connectedRoutingServerSocket != null)
					connectedRoutingServerSocket.close();
				
				connectedRoutingServerSocket = null;
				rin = null;
				rdis = null;
				rout = null;
				rdos = null;
			}
		}
		
		return isSucceedToConnect;
	}
	
	private boolean disconnectFromRoutingServer(){
		
		boolean isSucceedToDisconnect = true;
		
		mRedayToCommunication = false;
		roomId = null;
		
		
		try {
			if(rdis != null)
				rdis.close();
			if(rdos != null)
				rdos.close();
			if(connectedRoutingServerSocket != null)			
				connectedRoutingServerSocket.close();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			isSucceedToDisconnect = false;
		}
		
		connectedRoutingServerSocket = null;
		rin = null;
		rdis = null;
		rout = null;
		rdos = null;
		
		return isSucceedToDisconnect;
	}
	
	private void requestSameRoomUserInfo() throws IOException{
		StringBuilder sb = new 	StringBuilder("SRInfo ");
		sb.append(roomId);
		sb.append(NULL_CHARACTER_DELIMITER);
		roomdos.writeBytes(sb.toString());
		System.out.println("adfaef" + sb.toString());
	}
	
	public boolean joinRoom(String aRoomName){	

		
		try {
			if(!connectToRoutingServer()){
				System.out.println("Failed to connect to the Routing Server");
				return false;
			}
		} catch (IOException e) {
			System.out.println("Couldn't handle connecting Execption Status.... Force close process...");
			e.printStackTrace();
			System.exit(1);
		}
		StringBuilder sb = new StringBuilder("AddrPortReq ");
		sb = sb.append(aRoomName);
		sb = sb.append(NULL_CHARACTER_DELIMITER);
		
		try {
			rdos.writeBytes(sb.toString());
		} catch (IOException e) {
			
			System.out.println("Failed to send req message to the Routing Server");
			
			e.printStackTrace();
			return false;
		}
		
		Future<Boolean> future = es.submit(new routingServerCommCallable());
		
		Boolean result = false;
		try {
			result = future.get();
		} catch (InterruptedException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			result = false;
		} catch (ExecutionException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			result = false;
		}
		
		return result;
		
	}
	
	public void leaveRoom() throws IOException{
		if(connectedRoomServerSocket == null){
			System.out.println("There is no room to leave");
			return;
		}
		StringBuilder sb = new StringBuilder("leave ");
		sb = sb.append(roomId);
		sb = sb.append(NULL_CHARACTER_DELIMITER);
		System.out.println(sb.toString());
		roomdos.writeBytes(sb.toString());
	}

	
	private class routingServerCommCallable implements Callable<Boolean>{

		@Override
		public Boolean call() throws Exception {
			
			byte readByte = 0;
			String stringOfAddrPortRet;
			String[] infoOfAddrPortRet;
			
			StringBuilder sb = new StringBuilder("");
			
			while(true){
				try {
					readByte = rdis.readByte();
					System.out.println((char)readByte);
					//System.out.println(rdis.readUTF());
					//readByte = rdis.readByte();
				} catch (EOFException e){
					;
				} catch (IOException e) {
					System.out.println("Error occured....While getting Response from server for the \"AddrPortReq\"");
					
					e.printStackTrace();
					return false;
				}
				
				if(readByte == NULL_CHARACTER_DELIMITER_BYTE)
					break;
				
				sb = sb.append((char)readByte);
					

			}
				
			stringOfAddrPortRet = sb.toString();
			
			infoOfAddrPortRet = stringOfAddrPortRet.split(SPACE_DELIMITER);
			
			if(infoOfAddrPortRet[0].equals("AddrPortRet") && infoOfAddrPortRet.length == 4){
				
				disconnectFromRoutingServer();
				
				if(connectedRoomServerSocket != null){
					roomdis.close();
					roomdos.close();
					connectedRoomServerSocket.close();
					
					roomdis = null;
					roomdos = null;
					connectedRoomServerSocket = null;
					
					mRedayToCommunication = false;
					roomId = null;
				}
				
				String serverAddr = infoOfAddrPortRet[1];
				String serverTcpPort = infoOfAddrPortRet[2];
				String roomName = infoOfAddrPortRet[3];
				
				connectedRoomServerSocket = new Socket(serverAddr, Integer.parseInt(serverTcpPort));
				
				roomin = connectedRoomServerSocket.getInputStream();
				roomdis = new DataInputStream(roomin);
			
				roomout = connectedRoomServerSocket.getOutputStream();
				roomdos = new DataOutputStream(roomout);
				
				//sb.setLength(0);
				sb.delete(0, sb.length());
				//sb = new StringBuilder("");
				sb.append("JoinReq ");
				sb.append(roomName); sb.append(SPACE_DELIMITER);
				sb.append(userId);
				sb.append(" 0");
				sb.append(NULL_CHARACTER_DELIMITER);
				
				roomdos.writeBytes(sb.toString());
				
				es.submit(new roomServerCommCallable());
			}
			else{
				System.out.println("Failed to parse the AddrPortRet Response");
				return false;
			}
			
			

			return true;
		}

		
	
	}
	
	
	
	private class roomServerCommCallable implements Callable<Boolean>{

		@Override
		public Boolean call() throws Exception {
			
			byte readByte = 0;
			String stringOfAddrPortRet;
			String[] infoOfAddrPortRet;
			
			StringBuilder sb = new StringBuilder("");
			
			while(true){
				try {
					readByte = roomdis.readByte();
				} catch (EOFException e){
					;
				} catch (IOException e) {
					System.out.println("Error occured....While getting Response from server");
					
					e.printStackTrace();
					break;
				}			
					
				if(readByte == NULL_CHARACTER_DELIMITER_BYTE){
					
					System.out.println(sb.toString());
					String infoString = sb.toString();
					String[] infoArray = infoString.split(SPACE_DELIMITER);
					
					if(infoArray[0].equals("JoinRet") && (infoArray.length == 4 || infoArray.length == 6)){
						int approval = Integer.parseInt(infoArray[1]);
						if(!mRedayToCommunication){
							if(approval == 1){
								mRedayToCommunication = true;
								roomId = infoArray[2];	
								requestSameRoomUserInfo();
								connectionCallback();
							}
							else{
	
								String newServerAddr = infoArray[2];
								int newServerPort = Integer.parseInt(infoArray[3]);
								String roomName = infoArray[4];
								int retryCount = Integer.parseInt(infoArray[5]);
								
								roomdis.close();
								roomdos.close();
								connectedRoomServerSocket.close();
								
								roomdis = null;
								roomdos = null;
								connectedRoomServerSocket = null;
								
								mRedayToCommunication = false;
								roomId = null;
								
								if(retryCount > 30){
									System.out.println("Failed to connect to RoomSocketIo " +  newServerAddr + ":" + newServerPort + " / " + roomName + " (more than 30 times)");
									break;
								}
								
								connectedRoomServerSocket = new Socket(newServerAddr, newServerPort);
								
								roomin = connectedRoomServerSocket.getInputStream();
								roomdis = new DataInputStream(roomin);
							
								roomout = connectedRoomServerSocket.getOutputStream();
								roomdos = new DataOutputStream(roomout);
								
								//sb.setLength(0);
								sb.delete(0, sb.length());
								//sb = new StringBuilder("");
								sb.append("JoinReq ");
								sb.append(roomName); sb.append(SPACE_DELIMITER);
								sb.append(userId);	sb.append(SPACE_DELIMITER);
								sb.append((retryCount+1));
								sb.append(NULL_CHARACTER_DELIMITER);
								
								roomdos.writeBytes(sb.toString());
								
								
							}
						}
						else{
							if(roomId.equals(infoArray[2])){
								boolean isFound = false;
								for(int i=0; i<sameRoomUsers.size(); i++){
									if(sameRoomUsers.get(i).equals(infoArray[3])){
										isFound = true;
										break;
									}
										
								}
								if(!isFound){
									sameRoomUsers.add(infoArray[3]);
								}
							}
						}
						
					}
					else if(infoArray[0].equals("LeaveRet") && infoArray.length == 3){
						if(roomId.equals(infoArray[1])){
							for(int i=0; i<sameRoomUsers.size(); i++){
								if(sameRoomUsers.get(i).equals(infoArray[2])){
									sameRoomUsers.remove(i);
									break;
								}
									
							}
						}
					}
					else if(infoArray[0].equals("SRInfo")){
						for(int i=1; i<infoArray.length; i++){
							boolean isFound = false;
							for(int j=0; j<sameRoomUsers.size();j++){
								if(sameRoomUsers.get(j).equals(infoArray[i])){
									isFound = true;
									break;
								}
							}
							if(!isFound)
								sameRoomUsers.add(infoArray[i]);
						}
						
						for(int j=0; j<sameRoomUsers.size();j++){
							System.out.println("aaaa : " + sameRoomUsers.get(j));
						}
					}			
					else{
						if(mRedayToCommunication){
							
						}
					}
					
					//sb = new StringBuilder("");
					sb.delete(0, sb.length());
					//sb.setLength(0);
				}
				else
					sb = sb.append((char)readByte);
			}			

			return false;
		}

		
	
	}


}
