const initBridge = (bridge, interfaces) => {

    // check preconditions
    if (!bridge) return
    if (bridge.initialized) return

    class NativeError extends Error {

        constructor(message, nativeMessage, nativeStackTrace) {
            super(message)
            this.nativeMessage = nativeMessage
            this.nativeStackTrace = nativeStackTrace
            this.native = true
        }

        toString() {
            if (!this.stack) {
                return this.message + "\n"+ "Caused by: " + this.nativeStackTrace
            } else {
                return this.stack + "\n"+ "Caused by: " + this.nativeStackTrace
            }
        }
    }

    // enrich bridge
    const functionBindings = []
    let currentFunctionBinding = 0

    const addFunctionBinding = (f) => {
        functionBindings[currentFunctionBinding] = f
        return currentFunctionBinding++
    }

    bridge.getFunction = (functionBinding) => {
        return functionBindings[functionBinding]
    }

    bridge.removeFunction = (functionBinding) => {
        delete functionBindings[functionBinding]
    }

    bridge.getFunctionBinding = () => {
        return Object.keys(functionBindings)
    }

    bridge.interfaces = interfaces

    const callNativeInterface = (call) => {
        const callAsString = JSON.stringify(call)
        const answerAsString = bridge.nativeCall(callAsString)
        return JSON.parse(answerAsString)
    }

    bridge.nativeCallFullSync = (call) => {
        const answer = callNativeInterface(call)
        if (answer.hasError) {
            throw new NativeError("Error in Native Layer: ", answer.error.message, answer.error.stackTrace)
        }
        if (!answer.isVoid) {
            return answer.value
        }
    }

    bridge.nativeCallWebPromise = (call) => {
        return new Promise((resolve, reject) => {
            try {
                resolve(bridge.nativeCallFullSync(call))
            } catch (e) {
                reject(e)
            }
        })
    }

    bridge.nativeCallFullPromise = (call) => {
        return new Promise((resolve, reject) => {
            const functionBinding = addFunctionBinding((answer) => {
                if (answer.hasError) {
                    reject(new NativeError("Error in Native Layer: ", answer.error.message, answer.error.stackTrace))
                } else if (answer.isVoid) {
                    resolve()
                } else {
                    resolve(answer.value)
                }
            })
            try {
                call.promiseFunctionBinding = functionBinding
                bridge.nativeCallFullSync(call)
            } catch (e) {
                bridge.removeFunction(functionBinding)
                reject(e)
            }
        })
    }

    // set flag to true
    bridge.initialized = true

    // call listener
    if (bridge.afterInitialize) {
        bridge.afterInitialize()
    }

    bridge.nativeAfterInitialize()
}