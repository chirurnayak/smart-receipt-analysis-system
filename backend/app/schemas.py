from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    original_filename: str
    upload_date: datetime
    processing_status: str


class TransactionBase(BaseModel):
    receipt_id: int | None = None
    payer_name: str | None = Field(default=None, max_length=255)
    transaction_id: str | None = Field(default=None, max_length=255)
    amount: Decimal = Field(gt=0, decimal_places=2)
    transaction_date: datetime
    payment_method: str | None = Field(default=None, max_length=100)
    reference_number: str | None = Field(default=None, max_length=255)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    receipt_id: int | None = None
    payer_name: str | None = Field(default=None, max_length=255)
    transaction_id: str | None = Field(default=None, max_length=255)
    amount: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    transaction_date: datetime | None = None
    payment_method: str | None = Field(default=None, max_length=100)
    reference_number: str | None = Field(default=None, max_length=255)


class TransactionOut(TransactionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    duplicate_status: bool
    created_at: datetime


class OcrField(BaseModel):
    value: str | None = None
    confidence: str = "not_extracted"


class OcrResult(BaseModel):
    receipt_id: int
    processing_status: str
    extracted_text: str | None = None
    payer_name: OcrField
    transaction_id: OcrField
    transaction_date: OcrField
    amount: OcrField
    payment_method: OcrField
    reference_number: OcrField
    message: str | None = None
