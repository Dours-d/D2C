import { createContext, useContext } from 'react';

const AuthContext = createContext({ user: null });

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
