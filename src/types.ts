export interface message {
    title: string
    desp?: string
    text?: string
    tags?: string
    short?: string
}

export interface MsgLuna {
    userid: number
    authtoken: string
    assignee: string
}