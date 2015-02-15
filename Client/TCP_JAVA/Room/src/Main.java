import java.io.IOException;

import room_jtcp.Constants;
import room_jtcp.RoomMessageIOException;
import room_jtcp.Room_JTCP;


public class Main {

	public static void main(String[] args) {
		// TODO Auto-generated method stub
		Room_JTCP rjtcp = new Room_JTCP("127.0.0.1",52275,"jdj9354") {
			
			@Override
			public void connectionCallback() {
				System.out.println("Succeed to Estalbish Room");
				try {
					publicToCR("From TCP гого©Д", Constants.OPERATION_TYPE.READ);
				} catch (RoomMessageIOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}

		};
		
		rjtcp.joinRoom("FromTcpRoom");
		
		//System.out.println(room_jtcp.Constants.OPERATION_TYPE.CREATE.ordinal());
		
	}

}
