#!/bin/bash

echo "SNMP Test Script for Linux/Mac"
echo "==============================="
echo

if [ $# -lt 2 ]; then
    echo "Usage: ./test-snmp.sh <host> <version> [community] [username] [authPass] [privPass]"
    echo
    echo "Examples:"
    echo "  ./test-snmp.sh 192.168.1.1 2c public"
    echo "  ./test-snmp.sh 192.168.1.1 3 - SNMPv3User SNMPpass SNMPprivpass"
    echo
    exit 1
fi

export NODE_OPTIONS="--openssl-legacy-provider"
node scripts/testSnmp.js "$@"
