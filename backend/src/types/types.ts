import {z} from 'zod'

export const signupSchena = z.object({
    email: z.email(),
    username: z.string(),
    password: z.string().min(4)
})
export const signinSchena = z.object({
    email: z.email(),
    password: z.string().min(4)
})
export const addContntSchema = z.object({
 
})