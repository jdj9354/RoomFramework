package MessageItem;

//Only support for byte, short, int, long, float, double, boolean, char, String
public class MessageItem {
	
	
	public enum TYPES {BYTE, SHORT, INTEGER, LONG, FLOAT, DOUBLE, BOOLEAN, CHAR, STRING};
	protected TYPES mType;
	protected Object mMessage;

	
	public MessageItem(byte aMessage) {
		mType = TYPES.BYTE;
		mMessage = aMessage;
	}
	public MessageItem(short aMessage) {
		mType = TYPES.SHORT;
		mMessage = aMessage;
	}
	public MessageItem(int aMessage) {
		mType = TYPES.INTEGER;
		mMessage = aMessage;
	}
	public MessageItem(long aMessage) {
		mType = TYPES.LONG;
		mMessage = aMessage;
	}
	public MessageItem(float aMessage) {
		mType = TYPES.FLOAT;
		mMessage = aMessage;
	}
	public MessageItem(double aMessage) {
		mType = TYPES.DOUBLE;
		mMessage = aMessage;
	}
	public MessageItem(boolean aMessage) {
		mType = TYPES.BOOLEAN;
		mMessage = aMessage;
	}
	public MessageItem(char aMessage) {
		mType = TYPES.CHAR;
		mMessage = aMessage;
	}
	public MessageItem(String aMessage) {
		mType = TYPES.STRING;
		mMessage = aMessage;
	}
	

	public byte getByteMessage() throws MessageItemTypeException{
		if(mType != TYPES.BYTE)
			throw new MessageItemTypeException();
		return (byte)mMessage;
	}
	
	public short getShortMessage() throws MessageItemTypeException{
		if(mType != TYPES.SHORT)
			throw new MessageItemTypeException();
		return (short)mMessage;
	}
	
	public int getIntMessage() throws MessageItemTypeException{
		if(mType != TYPES.INTEGER)
			throw new MessageItemTypeException();
		return (int)mMessage;
	}
	
	public long getLongMessage() throws MessageItemTypeException{
		if(mType != TYPES.LONG)
			throw new MessageItemTypeException();
		return (long)mMessage;
	}
	
	public float getFloatMessage() throws MessageItemTypeException{
		if(mType != TYPES.FLOAT)
			throw new MessageItemTypeException();
		return (float)mMessage;
	}
	
	public double getDoubleMessage() throws MessageItemTypeException{
		if(mType != TYPES.DOUBLE)
			throw new MessageItemTypeException();
		return (double)mMessage;
	}
	
	public boolean getBooleanMessage() throws MessageItemTypeException{
		if(mType != TYPES.BOOLEAN)
			throw new MessageItemTypeException();
		return (boolean)mMessage;
	}
	
	public char getCharMessage() throws MessageItemTypeException{
		if(mType != TYPES.CHAR)
			throw new MessageItemTypeException();
		return (char)mMessage;
	}
	
	public String getStringMessage() throws MessageItemTypeException{
		if(mType != TYPES.STRING)
			throw new MessageItemTypeException();
		return (String)mMessage;
	}
	
	public TYPES getMessageType(){
		return mType;
	}

}
