"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/firebase-client";
import { guestRetentionCopy, operationalPolicy } from "../lib/service/policy";
export function ServicePolicy() {
  const [region, setRegion] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api<{ storageRegion: string }>("/service-policy", undefined, false)
      .then((p) => {
        if (active) setRegion(p.storageRegion);
      })
      .catch(() => {
        if (active)
          setError("저장 위치를 불러오지 못했어요. 새로고침 후 확인해주세요.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <article className="policy-copy">
      <h1>이용 안내와 개인정보</h1>
      <h2>서비스 이용 안내</h2>
      <p>
        직꼿은 편한 범위의 일상 움직임을 안내해요. 질환을 진단하거나 치료를
        대신하지 않아요. 의료진의 움직임 제한을 우선하고, 통증이 생기거나 더
        불편하면 멈춰주세요. 상태가 지속되거나 걱정되면 의료전문가에게
        확인해주세요. 정지 그림과 단계·실시량을 함께 읽어주세요.
      </p>
      <h2>계정과 개인정보</h2>
      <p>
        운영자: {operationalPolicy.operatorName}. 이메일, 닉네임, 인증 방식,
        사용자 식별값, 동의 버전·시각을 계정 관리에 사용해요. 비밀번호는
        Firebase Authentication이 처리하며 직꼿은 평문으로 저장하지 않아요.
      </p>
      <h2>건강 관련 입력의 별도 처리</h2>
      <p>
        불편 부위, 가능한 자세·움직임, 습관과 수행 후 느낌은 건강 관련 정보일 수
        있어요. 현재 조건에 맞는 안내, 불편했던 동작 제외와 내 기록 제공에
        사용해요. 별도 동의를 거절하면 개인화 기능을 이용할 수 없지만 홈과
        정책은 볼 수 있어요. 외부 AI에 전송하지 않아요.
      </p>
      <h2>보관과 삭제</h2>
      <p>
        회원 기록은 직접 삭제하거나 동의를 철회·탈퇴할 때까지 보관해요.
        로그아웃은 삭제가 아니에요. 기록 삭제·정정은 파생 개인화 정보에도
        반영돼요.
      </p>
      <p>
        {guestRetentionCopy} 비회원 기록은 이용일 다음 날 00:00 KST에 만료되어
        조회·복원·추천에 사용되지 않아요. 만료 자료는 10분 주기의 삭제 작업으로
        순차 정리하며 실패하면 재시도해요. 철회하면 건강 관련 자료를 삭제하고,
        당일 중복 이용 방지를 위한 건강 내용 없는 사용 표시는 그날 끝까지
        유지해요. 가입할 때 비회원 기록을 이전하지 않아요.
      </p>
      <p>
        계정 삭제 처리의 재시도 확인에 필요한 비건강 작업 표시는 다음 자정까지만
        보관한 뒤 같은 작업으로 정리해요. 기존 정책으로 수집한 자료는 새 만료
        규칙으로 일괄 파기하지 않으며 본인 삭제·철회 요청에 연결해 처리해요.
      </p>
      <h2>처리 서비스와 저장 위치</h2>
      <p>
        인증과 데이터는 Google Firebase, 웹과 API는 Cloudflare Workers에서
        처리해요. Firestore 실제 저장 위치: {region || "확인 중"}. 인증·보안
        처리와 Cloudflare의 전 세계 네트워크 운영 과정에서 국외 처리가 발생할 수
        있어요.
      </p>
      {error && <p role="alert">{error}</p>}
      <p>
        Worker 애플리케이션 요청 로그 수집은 꺼져 있어요. 삭제 작업은 건강 답변
        없이 결과·시각·실패 코드를 집계해요. 제공자가 별도로 처리하는 인증·보안
        접속 메타데이터는{" "}
        <a
          href="https://firebase.google.com/support/privacy"
          target="_blank"
          rel="noreferrer"
        >
          Firebase 개인정보 안내
        </a>
        와{" "}
        <a
          href="https://www.cloudflare.com/privacypolicy/"
          target="_blank"
          rel="noreferrer"
        >
          Cloudflare 처리방침
        </a>{" "}
        및 해당 서비스 계약을 따라 처리돼요.
      </p>
      <h2>문의와 권리 행사</h2>
      <p>
        열람·정정·삭제·동의 철회는 마이와 내 기록에서 진행할 수 있어요. 도움이
        필요하면{" "}
        <a href={"mailto:" + operationalPolicy.contactEmail}>
          {operationalPolicy.contactEmail}
        </a>
        로 문의해주세요.
      </p>
      <p>시행일·동의 버전: 2026-10-19</p>
    </article>
  );
}
