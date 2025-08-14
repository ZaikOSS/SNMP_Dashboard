from pysnmp.hlapi import *

iterator = getCmd(
    SnmpEngine(),
    UsmUserData(
        'zaikos',          # username
        'zaikos123456',    # auth password
        'zaikos123456',    # priv password
        authProtocol=usmHMACMD5AuthProtocol,
        privProtocol=usmAesCfb128Protocol
    ),
    UdpTransportTarget(('192.168.191.100', 161)),
    ContextData(),
    ObjectType(ObjectIdentity('1.3.6.1.2.1.1.1.0')),  # sysDescr
    lookupMib=False
)

errorIndication, errorStatus, errorIndex, varBinds = next(iterator)

if errorIndication:
    print("Error:", errorIndication)
elif errorStatus:
    print(f"{errorStatus.prettyPrint()} at {errorIndex}")
else:
    for varBind in varBinds:
        print(varBind)
