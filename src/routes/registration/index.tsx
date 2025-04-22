import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  GoogleOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, Select, Typography, message, Spin } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";
import { ThemedTitleV2 } from "@refinedev/antd";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

const { Title } = Typography;

export const RegisterPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);

  React.useEffect(() => {
    document.title = "Register • Incubation Platform";
  }, []);

  const handleRegister = async (values: any) => {
    try {
      setLoading(true);

      // 1. Create Firebase Auth user
      const userCred = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password,
      );

      const user = userCred.user;

      // 2. Add user info to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        role: values.role,
        name: values.name || "",
        createdAt: new Date().toISOString(),
      });

      // 3. Notify + Redirect
      message.success("🎉 Registration successful! Redirecting...", 2);
      setRedirecting(true);

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Add/merge into Firestore
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: user.displayName || "",
          email: user.email,
          role: "Incubatee", // or let user pick after redirect
          createdAt: new Date().toISOString(),
        },
        { merge: true }, // don't overwrite existing data
      );

      message.success("✅ Google sign-up successful! Redirecting...", 2);
      setRedirecting(true);

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error: any) {
      console.error(error);
      message.error(error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Spin spinning={loading || googleLoading || redirecting} size='large'>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          animation: "fadeIn 0.7s ease-in-out",
          backgroundImage: `url("/assets/images/bg-image.jpg")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          position: "relative",
        }}
      >
        {/* Logo + Title */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <ThemedTitleV2
            collapsed={false}
            text={
              <span
                style={{
                  color: "white",
                  fontSize: "32px",
                  fontWeight: "700",
                  letterSpacing: 1,
                }}
              >
                Incubation System
              </span>
            }
          />
        </div>

        {/* Card */}
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            padding: "48px 32px",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            background: "#ffffffee", // Slightly transparent background for contrast
            animation: "fadeInUp 0.6s ease-out",
            backdropFilter: "blur(5px)",
          }}
        >
          <Form
            layout='vertical'
            form={form}
            onFinish={handleRegister}
            requiredMark={false}
          >
            <Title
              level={4}
              style={{ textAlign: "center", marginTop: 16, color: "#1677ff" }}
            >
              Create your account
            </Title>
            <Form.Item
              name='name'
              label='Name'
              rules={[
                { required: true, message: "Please enter your full name" },
                { type: "name", message: "Enter a valid name" },
              ]}
            >
              <Input placeholder='Daniel Rumona' />
            </Form.Item>

            <Form.Item
              name='email'
              label='Email'
              rules={[
                { required: true, message: "Please enter your email" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input placeholder='you@example.com' />
            </Form.Item>

            <Form.Item
              name='password'
              label='Password'
              rules={[
                { required: true, message: "Please enter your password" },
                { min: 6, message: "Password must be at least 6 characters" },
              ]}
            >
              <Input.Password
                placeholder='Enter your password'
                iconRender={(visible) =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item
              name='role'
              label='Role'
              rules={[{ required: true, message: "Please select your role" }]}
            >
              <Select placeholder='Select your role'>
                <Select.Option value='Admin'>Admin</Select.Option>
                <Select.Option value='Operations'>Operations</Select.Option>
                <Select.Option value='Incubatee'>Incubatee</Select.Option>
                <Select.Option value='Funder'>Funder</Select.Option>
                <Select.Option value='Consultant'>Consultant</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button type='primary' htmlType='submit' block loading={loading}>
                Register
              </Button>
            </Form.Item>

            <Form.Item>
              <Button
                icon={<GoogleOutlined />}
                onClick={handleGoogleRegister}
                style={{ width: "100%" }}
                loading={googleLoading}
              >
                Register with Google
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            Already have an account?{" "}
            <a onClick={() => navigate("/login")} style={{ fontWeight: 500 }}>
              Login
            </a>
          </div>
        </div>

        {/* Quantilytix Floating Logo */}
        <img
          src='/assets/images/QuantilytixO.png'
          alt='Quantilytix Logo'
          style={{
            position: "absolute",
            bottom: 24,
            right: 15,
            height: 50,
            opacity: 0.9,
          }}
        />
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </Spin>
  );
};
