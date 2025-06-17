import { CloseOutlined } from "@ant-design/icons";
import { Button, Card, Drawer, Form, Input, Spin, message } from "antd";
import { useEffect, useState } from "react";

import { getNameInitials } from "@/utilities";
import { Text } from "../../text";
import { CustomAvatar } from "../../custom-avatar";

import { auth } from "@/firebase"; // Firebase client-side instance
import { updateEmail, updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase"; // Firestore instance

type Props = {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  userId: string;
};

export const AccountSettings = ({ opened, setOpened, userId }: Props) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userData, setUserData] = useState<any>(null);

  const closeModal = () => {
    setOpened(false);
  };

  // 🧠 Load current user profile from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          form.setFieldsValue(data);
          setUserData(data);
        }
      } catch (error) {
        message.error("Failed to load user profile.");
        console.log("User account error : ", { error });
      } finally {
        setLoading(false);
      }
    };

    if (opened && userId) {
      fetchUserData();
    }
  }, [opened, userId]);

  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      const user = auth.currentUser;

      if (!user) throw new Error("No authenticated user");

      // ✅ Update Firebase Auth profile
      await updateProfile(user, {
        displayName: values.name,
        photoURL: user.photoURL,
      });

      if (user.email !== values.email) {
        await updateEmail(user, values.email);
      }

      // ✅ Update Firestore profile
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        name: values.name,
        email: values.email,
        role: values.role,
      });

      message.success("Profile updated successfully!");
      setOpened(false);
    } catch (error: any) {
      console.error(error);
      message.error(error.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Drawer
        open={opened}
        width={756}
        styles={{
          body: {
            background: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }}
      >
        <Spin />
      </Drawer>
    );
  }

  return (
    <Drawer
      onClose={closeModal}
      open={opened}
      width={756}
      styles={{
        body: { background: "#f5f5f5", padding: 0 },
        header: { display: "none" },
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          backgroundColor: "#fff",
        }}
      >
        <Text strong>Account Settings</Text>
        <Button
          type='text'
          icon={<CloseOutlined />}
          onClick={() => closeModal()}
        />
      </div>
      <div style={{ padding: "16px" }}>
        <Card>
          <Form form={form} layout='vertical' onFinish={handleSave}>
            <Form.Item label='Name' name='name'>
              <Input placeholder='Name' />
            </Form.Item>

            <Form.Item label='Email' name='email'>
              <Input placeholder='Email' />
            </Form.Item>

            <Form.Item label='Role' name='role'>
              <Input placeholder='User Role' />
            </Form.Item>

            <Form.Item>
              <Button
                type='primary'
                htmlType='submit'
                loading={saving}
                style={{ float: "right" }}
              >
                Save Changes
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </Drawer>
  );
};
