package MessageItem;

import java.util.ArrayList;

public abstract class MessageItems extends ArrayList<MessageItem>{
	public MessageItems(String aMessageString){
		stringParser(aMessageString,this);
	}
	
	public abstract void stringParser(String inputString, ArrayList<MessageItem> outputArray);
}
