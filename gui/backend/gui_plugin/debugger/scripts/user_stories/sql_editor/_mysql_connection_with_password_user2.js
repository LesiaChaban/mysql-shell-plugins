var lib = ws.tokens.lib
var defaults = ws.tokens.defaults

ws.log("Opening connection user2")

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sql_editor.open_connection",
    "args": {
        "db_connection_id": lib.sql_editor.create_test_sessions['connection_id_user2'],
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "ERROR",
            "msg": "Access denied for user 'user2'@'localhost' (using password: NO)",
            "code": 1045,
            "source": "MYSQL"
        }
    }
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.sql_editor.open_connection",
    "args": {
        "db_connection_id": lib.sql_editor.create_test_sessions['connection_id_user2'],
        "module_session_id": ws.lastModuleSessionId,
        "password": "user2password"
    }
}, [
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "PENDING",
            "msg": "Connection was successfully opened."
        },
        "result": {
            "module_session_id": ws.lastModuleSessionId,
            "info": {},
            "default_schema": ws.ignore
        }
    },
    {
        "request_id": ws.lastGeneratedRequestId,
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "done": true
    }
])
