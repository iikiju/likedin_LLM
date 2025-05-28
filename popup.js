document.addEventListener('DOMContentLoaded', async () => {
  console.log('팝업 로드됨');
  
  // API 키 관련 이벤트 리스너
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const editApiKeyBtn = document.getElementById('edit-api-key');
  const removeApiKeyBtn = document.getElementById('remove-api-key');
  
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
      console.log('API 키 저장 버튼 클릭됨');
      const apiKey = document.getElementById('openai-api-key').value.trim();
      if (!apiKey) {
        showError('API 키를 입력해주세요.');
        return;
      }
      
      chrome.storage.local.set({ 'openaiApiKey': apiKey }, () => {
        console.log('API 키 저장됨');
        document.getElementById('api-key-form').style.display = 'none';
        document.getElementById('api-key-status').style.display = 'block';
        showStatus('API 키가 저장되었습니다.');
      });
    });
  }

  if (editApiKeyBtn) {
    editApiKeyBtn.addEventListener('click', () => {
      console.log('API 키 수정 버튼 클릭됨');
      document.getElementById('api-key-form').style.display = 'block';
      document.getElementById('api-key-status').style.display = 'none';
      document.getElementById('openai-api-key').focus();
    });
  }

  if (removeApiKeyBtn) {
    removeApiKeyBtn.addEventListener('click', () => {
      console.log('API 키 제거 버튼 클릭됨');
      chrome.storage.local.remove('openaiApiKey', () => {
        document.getElementById('openai-api-key').value = '';
        document.getElementById('api-key-form').style.display = 'block';
        document.getElementById('api-key-status').style.display = 'none';
        showStatus('API 키가 제거되었습니다.');
      });
    });
  }

  // 저장된 API 키 불러오기
  loadApiKey();
  
  // 도구 버튼 이벤트 리스너 추가
  document.getElementById('check-ollama').addEventListener('click', checkOllamaConnection);
  document.getElementById('use-js-prompt').addEventListener('click', () => switchPromptProfile('JS'));
  document.getElementById('use-sm-prompt').addEventListener('click', () => switchPromptProfile('SM'));
  const customProfileBtn = document.getElementById('custom-profile-btn');
  customProfileBtn.addEventListener('click', async () => {
    // 이미 활성화된 상태라면 폼을 토글(숨김)
    if (customProfileBtn.classList.contains('active')) {
      const customForm = document.getElementById('custom-profile-form');
      if (!customForm.classList.contains('hidden')) {
        customForm.classList.add('hidden');
        return;
      }
    }
    try {
      await chrome.storage.local.set({ promptProfile: 'CUSTOM' });
      updatePromptButtonStyles('CUSTOM');
      const customForm = document.getElementById('custom-profile-form');
      if (!customForm) {
        console.error('custom-profile-form element not found');
        showError('custom-profile-form element not found');
        return;
      }
      customForm.classList.remove('hidden');
      const { customProfile } = await chrome.storage.local.get('customProfile');
      if (customProfile) {
        loadCustomProfile(customProfile);
        showStatus(`Persona switched to: ${customProfile.name} (${customProfile.age}세)`);
      } else {
        showStatus('Custom Profile (Setup Required)');
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('linkedin.com')) {
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: 'checkCompanyInfo' },
            (response) => {
              if (response && response.companiesInfo && response.companiesInfo.length > 0) {
                showCompanyList(response.companiesInfo, currentTab.id);
              } else {
                showStatus('LinkedIn 페이지에서 회사 정보를 찾을 수 없습니다. 회사 프로필이나 채용 공고 페이지를 방문해보세요.');
              }
            }
          );
        }
      });
    } catch (error) {
      console.error('프로필 전환 오류:', error);
      showError('프로필 전환 중 오류가 발생했습니다.');
    }
  });
  document.getElementById('save-profile').addEventListener('click', saveCustomProfile);
  document.getElementById('cancel-profile').addEventListener('click', hideCustomProfileForm);
  
  // 현재 프롬프트 프로필 표시
  loadCurrentPromptProfile();
  
  // 커스텀 프로필 불러오기
  loadCustomProfileData();
  
  // 현재 탭의 URL 확인
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;
    
    console.log('현재 탭 URL:', url);
    
    // LinkedIn 프로필 페이지인지 확인
    if (url && url.includes('linkedin.com/in/')) {
      console.log('LinkedIn 프로필 페이지 확인됨');
      showStatus('프로필 정보를 불러오는 중...');
      
      // 프로필 정보 추출 요청
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: 'extractProfileInfo' },
        (response) => {
          if (response && response.success && response.profileInfo) {
            console.log('프로필 정보 추출 성공:', response.profileInfo);
            // 프로필 정보를 폼에 채우기
            fillProfileForm(response.profileInfo);
            // 커스텀 프로필 폼 표시
            toggleCustomProfileForm();
          } else {
            console.error('프로필 정보 추출 실패:', response?.error);
            showStatus('프로필 정보를 불러올 수 없습니다. 페이지를 새로고침하고 다시 시도해보세요.');
          }
        }
      );
    }
    // LinkedIn 회사/채용 페이지인지 확인
    else if (url && url.includes('linkedin.com')) {
      // 기존 회사 정보 로딩 로직
      console.log('LinkedIn 페이지 확인됨, 회사 정보 요청 중...');
      showStatus('회사 정보를 불러오는 중...');
      
      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        showStatus('회사 정보를 불러오는데 시간이 너무 오래 걸립니다. 페이지를 새로고침하고 다시 시도해보세요.');
      }, 10000);
      
      try {
        chrome.tabs.sendMessage(
          currentTab.id, 
          { action: 'checkCompanyInfo' },
          (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              console.error('메시지 전송 오류:', chrome.runtime.lastError.message);
              showStatus('LinkedIn 페이지에서 회사 정보를 확인하세요. 페이지를 새로고침하거나 다른 LinkedIn 페이지를 시도해보세요.');
              return;
            }
            
            console.log('컨텐츠 스크립트 응답:', response);
            
            if (response && response.companiesInfo && response.companiesInfo.length > 0) {
              showCompanyList(response.companiesInfo, currentTab.id);
            } else {
              showStatus('LinkedIn 페이지에서 회사 정보를 찾을 수 없습니다. 회사 프로필이나 채용 공고 페이지를 방문해보세요.');
            }
          }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('메시지 전송 중 예외 발생:', error);
        showStatus('LinkedIn 페이지와의 통신 중 오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해보세요.');
      }
    } else {
      showStatus('LinkedIn 페이지에서 익스텐션을 실행하세요.');
    }
  });

  // 프로필 정보 가져오기 버튼 추가
  const customProfileForm = document.getElementById('custom-profile-form');
  if (customProfileForm) {
    const loadProfileButton = document.createElement('button');
    loadProfileButton.type = 'button';
    loadProfileButton.className = 'load-profile-btn';
    loadProfileButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      LinkedIn 프로필에서 정보 가져오기
    `;
    
    loadProfileButton.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.url.includes('linkedin.com/in/')) {
          chrome.tabs.sendMessage(currentTab.id, { action: 'extractProfileInfo' }, (response) => {
            if (response && response.success) {
              console.log('프로필 정보 추출 성공:', response.profileInfo);
              fillProfileForm(response.profileInfo);
            } else {
              console.error('프로필 정보 추출 실패:', response?.error);
              showStatus('프로필 정보를 가져올 수 없습니다. LinkedIn 프로필 페이지에서 다시 시도해주세요.');
            }
          });
        } else {
          showStatus('LinkedIn 프로필 페이지에서만 사용할 수 있습니다.');
        }
      });
    });
    
    // 버튼을 폼의 맨 위에 추가
    customProfileForm.insertBefore(loadProfileButton, customProfileForm.firstChild);
  }

  // 프로필 정보 가져오기 버튼 이벤트 리스너
  const loadProfileBtn = document.getElementById('load-profile-btn');
  if (loadProfileBtn) {
    loadProfileBtn.addEventListener('click', () => {
      console.log('프로필 정보 가져오기 버튼 클릭됨');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab.url.includes('linkedin.com/in/')) {
          showStatus('프로필 정보를 가져오는 중...');
          chrome.tabs.sendMessage(currentTab.id, { action: 'extractProfileInfo' }, (response) => {
            if (response && response.success) {
              console.log('프로필 정보 추출 성공:', response.profileInfo);
              fillProfileForm(response.profileInfo);
              showStatus('프로필 정보를 성공적으로 가져왔습니다.');
            } else {
              console.error('프로필 정보 추출 실패:', response?.error);
              showStatus('프로필 정보를 가져올 수 없습니다. LinkedIn 프로필 페이지에서 다시 시도해주세요.');
            }
          });
        } else {
          showStatus('LinkedIn 프로필 페이지에서만 사용할 수 있습니다.');
        }
      });
    });
  }

  // LinkedIn 프로필 URL로부터 정보 가져오기
  const loadProfileUrlBtn = document.getElementById('load-profile-url-btn');
  if (loadProfileUrlBtn) {
    loadProfileUrlBtn.addEventListener('click', async () => {
      console.log('가져오기 버튼 클릭됨');
      try {
        const profileUrl = document.getElementById('linkedin-profile-url').value.trim();
        console.log('입력된 URL:', profileUrl);
        
        if (!profileUrl) {
          showStatus('LinkedIn 프로필 URL을 입력해주세요.');
          return;
        }

        if (!profileUrl.includes('linkedin.com/in/')) {
          showStatus('올바른 LinkedIn 프로필 URL을 입력해주세요.');
          return;
        }

        // 로딩 오버레이 표시
        const loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay) {
          console.error('로딩 오버레이 요소를 찾을 수 없습니다.');
          return;
        }

        // 로딩 오버레이 활성화
        loadingOverlay.classList.add('active');
        loadProfileUrlBtn.disabled = true;
        
        // 현재 탭에서 프로필 열기
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (!currentTab) {
          throw new Error('현재 탭을 찾을 수 없습니다.');
        }

        console.log('현재 탭 ID:', currentTab.id);
        console.log('프로필 URL로 이동:', profileUrl);

        // 탭 업데이트 및 프로필 정보 추출
        const updatedTab = await chrome.tabs.update(currentTab.id, { url: profileUrl });
        console.log('탭 업데이트됨:', updatedTab);
        
        // 탭이 로드될 때까지 대기하는 Promise
        const waitForTabLoad = new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('페이지 로딩 시간 초과'));
          }, 30000); // 30초 타임아웃

          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            console.log('탭 업데이트 이벤트:', tabId, changeInfo);
            if (tabId === updatedTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              clearTimeout(timeoutId);
              resolve();
            }
          });
        });

        try {
          await waitForTabLoad;
          console.log('페이지 로드 완료');
          
          // 페이지가 완전히 로드될 때까지 추가 대기
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('추가 대기 완료');
          
          // 프로필 정보 추출
          console.log('프로필 정보 추출 시작');
          const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(updatedTab.id, { action: 'extractProfileInfo' }, (response) => {
              console.log('프로필 정보 추출 응답:', response);
              resolve(response);
            });
          });

          if (response && response.success) {
            console.log('프로필 정보 추출 성공:', response.profileInfo);
            fillProfileForm(response.profileInfo);
            showStatus('프로필 정보를 성공적으로 가져왔습니다.');
          } else {
            throw new Error(response?.error || '프로필 정보를 가져올 수 없습니다.');
          }
        } catch (error) {
          console.error('프로필 정보 추출 중 오류:', error);
          showStatus(`프로필 정보를 가져올 수 없습니다: ${error.message}`);
        } finally {
          // 로딩 오버레이 비활성화
          loadingOverlay.classList.remove('active');
          loadProfileUrlBtn.disabled = false;
        }
      } catch (error) {
        console.error('프로필 로딩 중 오류:', error);
        showStatus(`오류가 발생했습니다: ${error.message}`);
        
        // 오류 발생 시에도 로딩 상태 해제
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
          loadingOverlay.classList.remove('active');
        }
        if (loadProfileUrlBtn) {
          loadProfileUrlBtn.disabled = false;
        }
      }
    });
  }

  // 페이지 로드 시 초기화
  try {
    // 현재 선택된 프롬프트 프로필 확인
    const { promptProfile = 'JS' } = await chrome.storage.local.get('promptProfile');
    
    // 버튼 스타일 업데이트
    updatePromptButtonStyles(promptProfile);
    
    // Custom 프로필이 선택된 경우 폼 표시
    if (promptProfile === 'CUSTOM') {
      const customForm = document.getElementById('custom-profile-form');
      customForm.classList.remove('hidden');
      
      // 저장된 커스텀 프로필이 있으면 로드
      const { customProfile } = await chrome.storage.local.get('customProfile');
      if (customProfile) {
        loadCustomProfile(customProfile);
      }
    }
    
    // API 키 상태 확인
    checkApiKeyStatus();
  } catch (error) {
    console.error('초기화 오류:', error);
    showError('초기화 중 오류가 발생했습니다.');
  }
});

// 회사 목록 표시
function showCompanyList(companies, tabId) {
  console.log('Showing company list:', companies);
  
  // company-info 요소 비우기
  const companyInfoElement = document.getElementById('company-info');
  if (!companyInfoElement) {
    console.error('company-info element not found');
    return;
  }
  
  companyInfoElement.innerHTML = '';
  companyInfoElement.classList.remove('hidden');
  
  // 에러 메시지 숨기기
  const errorContainer = document.getElementById('error-container');
  if (errorContainer) {
    errorContainer.classList.add('hidden');
  }
  
  // 제목 추가
  const titleElement = document.createElement('h3');
  titleElement.textContent = '<Select a company to analyze>';
  titleElement.style.marginBottom = '10px';
  companyInfoElement.appendChild(titleElement);
  
  // 회사가 없으면 메시지 표시
  if (!companies || companies.length === 0) {
    console.log('No companies to display');
    const messageElement = document.createElement('p');
    messageElement.className = 'status-message';
    messageElement.textContent = '회사 정보를 찾을 수 없습니다.';
    companyInfoElement.appendChild(messageElement);
    return;
  }
  
  console.log('Creating company list with', companies.length, 'companies');
  // 회사 목록 생성
  const listElement = document.createElement('ul');
  listElement.className = 'company-list';
  listElement.style.listStyle = 'none';
  listElement.style.padding = '0';
  listElement.style.margin = '0';
  
  companies.forEach((company, index) => {
    const listItem = document.createElement('li');
    listItem.style.padding = '8px 0';
    listItem.style.borderBottom = '1px solid #eee';
    listItem.style.cursor = 'pointer';
    listItem.style.display = 'flex';
    listItem.style.justifyContent = 'space-between';
    listItem.style.alignItems = 'center';
    
    // 회사 정보 컨테이너
    const infoContainer = document.createElement('div');
    
    // 회사명
    const nameElement = document.createElement('div');
    nameElement.textContent = company.name;
    nameElement.style.fontWeight = 'bold';
    infoContainer.appendChild(nameElement);
    
    // 산업 정보가 있으면 표시
    if (company.industry) {
      const industryElement = document.createElement('div');
      industryElement.textContent = company.industry;
      industryElement.style.fontSize = '12px';
      industryElement.style.color = '#666';
      infoContainer.appendChild(industryElement);
    }
    
    listItem.appendChild(infoContainer);
    
    // 분석 버튼
    const analyzeButton = document.createElement('button');
    analyzeButton.textContent = '분석';
    analyzeButton.style.backgroundColor = '#0077b5';
    analyzeButton.style.color = 'white';
    analyzeButton.style.border = 'none';
    analyzeButton.style.borderRadius = '4px';
    analyzeButton.style.padding = '4px 8px';
    analyzeButton.style.fontSize = '12px';
    analyzeButton.style.cursor = 'pointer';
    
    // 버튼 컨테이너
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.appendChild(analyzeButton);
    
    // 분석 버튼 클릭 이벤트
    analyzeButton.addEventListener('click', () => {
      // 선택된 회사 분석 시작
      showLoading();
      
      // 컨텐츠 스크립트에 특정 회사 분석 요청
      chrome.tabs.sendMessage(
        tabId,
        { action: 'analyzeSelectedCompany', companyName: company.name },
        (response) => {
          if (response && response.success && response.companyInfo) {
            // 백그라운드 스크립트에 분석 요청
            analyzeCompany(response.companyInfo);
          } else {
            showError('회사 정보를 찾을 수 없습니다.');
          }
        }
      );
    });
    
    listItem.appendChild(buttonContainer);
    listElement.appendChild(listItem);
  });
  
  companyInfoElement.appendChild(listElement);
  
  // 분석 결과 및 로딩 숨기기
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
}

// OpenAI API 연결 상태 확인
async function checkOllamaConnection() {
  try {
    showStatus('OpenAI API Connection Checking...');
    document.getElementById('error-container').classList.add('hidden');
    
    // OpenAI API 키 확인
    const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');
    if (!openaiApiKey) {
      showError('OpenAI API 키가 설정되지 않았습니다. API 키를 설정해주세요.');
      showStatus('OpenAI API 키 설정이 필요합니다.');
      return;
    }

    // 간단한 API 호출로 연결 테스트
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Hello, this is a connection test.'
          }
        ],
        max_tokens: 10
      })
    });

    if (response.ok) {
      showStatus('OpenAI API 연결 성공! 분석 준비가 완료되었습니다.');
    } else {
      const errorData = await response.json();
      showError(`OpenAI API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`);
      showStatus('OpenAI API 연결 실패. API 키를 확인해주세요.');
    }
  } catch (error) {
    console.error('OpenAI API 연결 오류:', error);
    showError('OpenAI API 연결 오류: ' + error.message);
    showStatus('OpenAI API 연결 실패. 네트워크 연결을 확인해주세요.');
  }
}

// 에러 메시지 표시
function showError(message) {
  console.error('에러 메시지:', message);
  const errorContainer = document.getElementById('error-container');
  errorContainer.textContent = message;
  errorContainer.classList.remove('hidden');
}

// 상태 메시지 표시
function showStatus(message) {
  console.log('상태 메시지:', message);
  const companyInfoElement = document.getElementById('company-info');
  companyInfoElement.innerHTML = `<div class="status-message">${message}</div>`;
  companyInfoElement.classList.remove('hidden');
  
  // 다른 요소 숨기기
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
}

// 로딩 화면 표시
function showLoading() {
  console.log('로딩 화면 표시');
  document.getElementById('company-info').classList.add('hidden');
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  
  const loadingElement = document.getElementById('loading');
  loadingElement.innerHTML = '<div class="spinner"></div><p>Analyzing...</p>';
  loadingElement.classList.remove('hidden');
}

// 분석 결과 표시
function showAnalysisResult(data) {
  console.log('분석 결과 표시:', data);
  document.getElementById('company-info').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  
  const resultContainer = document.getElementById('analysis-result');
  resultContainer.classList.remove('hidden');
  
  // 회사 정보 업데이트
  document.getElementById('company-name').textContent = data.name;
  document.getElementById('salary-info').textContent = data.salary || '정보 없음';
  document.getElementById('benefits-info').textContent = data.benefits || '정보 없음';
  document.getElementById('job-fit-info').textContent = data.jobFit || '정보 없음';
  document.getElementById('rating-text').textContent = data.summary || '정보 없음';
  
  // 별점 업데이트
  updateStars(data.rating || 0);
  
  // "돌아가기" 버튼 추가
  if (!document.querySelector('.back-to-list-btn')) {
    const backBtn = document.createElement('button');
    backBtn.textContent = 'back to list';
    backBtn.className = 'back-to-list-btn';
    backBtn.style.marginTop = '12px';
    
    backBtn.addEventListener('click', () => {
      // 현재 탭에서 다시 회사 정보 요청
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { action: 'checkCompanyInfo' },
          (response) => {
            if (response && response.companiesInfo) {
              showCompanyList(response.companiesInfo, tabs[0].id);
            } else {
              showStatus('Company info not found.');
            }
          }
        );
      });
    });
    
    resultContainer.appendChild(backBtn);
  }
}

// 별점 표시 업데이트
function updateStars(rating) {
  console.log('별점 업데이트:', rating);
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    const starRating = parseInt(star.getAttribute('data-rating'));
    if (starRating <= Math.floor(rating)) {
      star.classList.add('active');
      star.innerText = '★';
    } else if (starRating === Math.ceil(rating) && rating % 1 >= 0.5) {
      star.classList.add('active');
      star.innerText = '☆'; // 반쪽 별(혹은 커스텀 SVG로 대체 가능)
    } else {
      star.classList.remove('active');
      star.innerText = '★';
    }
  });
}

// 회사 분석 요청
function analyzeCompany(companyInfo) {
  console.log('회사 분석 요청:', companyInfo);
  
  // 백그라운드 스크립트에 분석 요청
  chrome.runtime.sendMessage(
    { action: 'analyzeCompany', companyInfo },
    (response) => {
      console.log('분석 응답 수신:', response);
      if (response && response.success) {
        showAnalysisResult(response.data);
      } else {
        console.error('분석 오류:', response);
        showError('분석 오류: ' + (response?.error || '알 수 없는 오류'));
      }
    }
  );
}

// 커스텀 프로필 폼 토글
function toggleCustomProfileForm() {
  const form = document.getElementById('custom-profile-form');
  const isVisible = form.style.display !== 'none';
  
  if (!isVisible) {
    // 폼이 보이지 않을 때만 프로필 정보 로드
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (currentTab.url.includes('linkedin.com/in/')) {
        // LinkedIn 프로필 페이지인 경우
        chrome.tabs.sendMessage(currentTab.id, { action: 'extractProfileInfo' }, (response) => {
          if (response && response.success) {
            console.log('프로필 정보 추출 성공:', response.profileInfo);
            fillProfileForm(response.profileInfo);
          } else {
            console.error('프로필 정보 추출 실패:', response?.error);
            showStatus('프로필 정보를 가져올 수 없습니다. LinkedIn 프로필 페이지에서 다시 시도해주세요.');
          }
        });
      } else {
        // LinkedIn 프로필 페이지가 아닌 경우 저장된 정보 로드
        loadCustomProfile();
      }
    });
  }
  
  form.style.display = isVisible ? 'none' : 'block';
  
  // 토글 버튼 텍스트 업데이트
  const toggleBtn = document.getElementById('toggle-custom-profile-form-btn');
  toggleBtn.textContent = isVisible ? 'Show Form' : 'Hide Form';
}

// 프로필 폼에 정보 채우기
function fillProfileForm(profileInfo) {
  console.log('프로필 정보 채우기:', profileInfo);
  
  // 프로필 정보 표시
  displayProfileInfo(profileInfo);
  
  // 기존 폼 필드 채우기
  if (profileInfo.name) document.getElementById('name').value = profileInfo.name;
  if (profileInfo.title) document.getElementById('title').value = profileInfo.title;
  if (profileInfo.company) document.getElementById('company').value = profileInfo.company;
  
  // 커스텀 프로필 폼 표시
  toggleCustomProfileForm();
}

// 커스텀 프로필 저장
function saveCustomProfile() {
  const customProfile = {
    name: document.getElementById('custom-name').value,
    age: document.getElementById('custom-age').value,
    location: document.getElementById('custom-location').value,
    major: document.getElementById('custom-major').value,
    field: document.getElementById('custom-field').value,
    salary: document.getElementById('custom-salary').value,
    workType: document.getElementById('custom-worktype').value,
    skills: document.getElementById('custom-skills').value.split(',').map(s => s.trim()).filter(s => s),
    toggleStates: {
      name: document.getElementById('toggle-name').checked,
      age: document.getElementById('toggle-age').checked,
      location: document.getElementById('toggle-location').checked,
      major: document.getElementById('toggle-major').checked,
      field: document.getElementById('toggle-field').checked,
      salary: document.getElementById('toggle-salary').checked,
      workType: document.getElementById('toggle-worktype').checked,
      skills: document.getElementById('toggle-skills').checked
    }
  };
  chrome.storage.local.set({ customProfile }, () => {
    console.log('커스텀 프로필 저장됨:', customProfile);
    showStatus('프로필이 저장되었습니다.');
    updateProfileDisplay(customProfile);
    hideCustomProfileForm(); // 저장 후 폼 숨김
  });
}

// 저장된 커스텀 프로필 로드
function loadCustomProfile() {
  chrome.storage.local.get(['customProfile'], (result) => {
    if (result.customProfile) {
      console.log('저장된 프로필 정보 로드:', result.customProfile);
      
      // 입력 필드 값 복원
      if (result.customProfile.name) document.getElementById('custom-name').value = result.customProfile.name;
      if (result.customProfile.age) document.getElementById('custom-age').value = result.customProfile.age;
      if (result.customProfile.location) document.getElementById('custom-location').value = result.customProfile.location;
      if (result.customProfile.major) document.getElementById('custom-major').value = result.customProfile.major;
      if (result.customProfile.field) document.getElementById('custom-field').value = result.customProfile.field;
      if (result.customProfile.salary) document.getElementById('custom-salary').value = result.customProfile.salary;
      if (result.customProfile.workType) document.getElementById('custom-worktype').value = result.customProfile.workType;
      if (result.customProfile.skills) document.getElementById('custom-skills').value = result.customProfile.skills.join(', ');
      
      // 토글 상태 복원
      if (result.customProfile.toggleStates) {
        document.getElementById('toggle-name').checked = result.customProfile.toggleStates.name;
        document.getElementById('toggle-age').checked = result.customProfile.toggleStates.age;
        document.getElementById('toggle-location').checked = result.customProfile.toggleStates.location;
        document.getElementById('toggle-major').checked = result.customProfile.toggleStates.major;
        document.getElementById('toggle-field').checked = result.customProfile.toggleStates.field;
        document.getElementById('toggle-salary').checked = result.customProfile.toggleStates.salary;
        document.getElementById('toggle-worktype').checked = result.customProfile.toggleStates.workType;
        document.getElementById('toggle-skills').checked = result.customProfile.toggleStates.skills;
      }
    } else {
      console.log('저장된 프로필 정보가 없습니다.');
      showStatus('새로운 프로필 정보를 입력해주세요.');
    }
  });
}

// 프롬프트 프로필 전환 함수
function switchPromptProfile(profile) {
  chrome.storage.local.set({ 'promptProfile': profile }, () => {
    console.log(`Prompt profile switched to: ${profile}`);
    let displayName = '';
    if (profile === 'JS') {
      displayName = 'JeoungSu (32M, Developer)';
    } else if (profile === 'SM') {
      displayName = 'SuMin (25F, Marketing)';
    } else if (profile === 'CUSTOM') {
      chrome.storage.local.get('customProfile', (data) => {
        if (data.customProfile) {
          displayName = `${data.customProfile.name} (${data.customProfile.age}세)`;
        } else {
          displayName = 'Custom Profile (Setup Required)';
        }
        showStatus(`Persona switched to: ${displayName}`);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          console.log('Current tab:', tabs[0]);
          const currentTab = tabs[0];
          if (currentTab.url && currentTab.url.includes('linkedin.com')) {
            console.log('Sending checkCompanyInfo message to tab:', currentTab.id);
            chrome.tabs.sendMessage(
              currentTab.id,
              { action: 'checkCompanyInfo' },
              (response) => {
                console.log('Received response from content script:', response);
                if (response && response.companiesInfo && response.companiesInfo.length > 0) {
                  console.log('Found companies:', response.companiesInfo);
                  showCompanyList(response.companiesInfo, currentTab.id);
                } else {
                  console.log('No companies found in response');
                  showStatus('LinkedIn 페이지에서 회사 정보를 찾을 수 없습니다. 회사 프로필이나 채용 공고 페이지를 방문해보세요.');
                }
              }
            );
          } else {
            console.log('Not a LinkedIn page:', currentTab.url);
          }
        });
      });
      updatePromptButtonStyles(profile);
      return;
    }
    showStatus(`Persona switched to: ${displayName}`);
    updatePromptButtonStyles(profile);
    // JS/SM 프로필일 때도 회사 리스트 요청
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (currentTab.url && currentTab.url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: 'checkCompanyInfo' },
          (response) => {
            if (response && response.companiesInfo && response.companiesInfo.length > 0) {
              showCompanyList(response.companiesInfo, currentTab.id);
            } else {
              showStatus('LinkedIn 페이지에서 회사 정보를 찾을 수 없습니다. 회사 프로필이나 채용 공고 페이지를 방문해보세요.');
            }
          }
        );
      }
    });
  });
}

// 현재 프롬프트 프로필 로드
function loadCurrentPromptProfile() {
  chrome.storage.local.get('promptProfile', (data) => {
    const profile = data.promptProfile || 'JS'; // 기본값: JS
    console.log(`Current prompt profile: ${profile}`);
    updatePromptButtonStyles(profile);
  });
}

// 프롬프트 버튼 스타일 업데이트
function updatePromptButtonStyles(activeProfile) {
  const jsButton = document.getElementById('use-js-prompt');
  const smButton = document.getElementById('use-sm-prompt');
  const customButton = document.getElementById('custom-profile-btn');
  
  // 모든 버튼 기본 스타일
  jsButton.style.backgroundColor = '#0077b5';
  smButton.style.backgroundColor = '#0077b5';
  customButton.style.backgroundColor = '#0077b5';
  
  // 활성 버튼 스타일
  if (activeProfile === 'JS') {
    jsButton.style.backgroundColor = '#4caf50';
  } else if (activeProfile === 'SM') {
    smButton.style.backgroundColor = '#4caf50';
  } else if (activeProfile === 'CUSTOM') {
    customButton.style.backgroundColor = '#4caf50';
  }
}

// 저장된 API 키 불러오기
function loadApiKey() {
  console.log('API 키 로드 시도');
  chrome.storage.local.get('openaiApiKey', (data) => {
    if (data.openaiApiKey) {
      console.log('저장된 API 키 발견');
      document.getElementById('openai-api-key').value = data.openaiApiKey;
      document.getElementById('api-key-form').style.display = 'none';
      document.getElementById('api-key-status').style.display = 'block';
    } else {
      console.log('저장된 API 키 없음');
      document.getElementById('api-key-form').style.display = 'block';
      document.getElementById('api-key-status').style.display = 'none';
    }
  });
}

function displayProfileInfo(profileInfo) {
  // 프로필 정보 섹션 표시
  const profileSection = document.getElementById('profile-info');
  profileSection.classList.remove('hidden');

  // 기본 정보 표시
  const basicInfo = document.getElementById('basic-info');
  basicInfo.innerHTML = `
    <div class="info-item">
      <strong>이름:</strong> ${profileInfo.name || '정보 없음'}
    </div>
    <div class="info-item">
      <strong>직함:</strong> ${profileInfo.title || '정보 없음'}
    </div>
    <div class="info-item">
      <strong>소속:</strong> ${profileInfo.company || '정보 없음'}
    </div>
  `;

  // 학력 정보 표시
  const educationInfo = document.getElementById('education-info');
  if (profileInfo.education && profileInfo.education.length > 0) {
    educationInfo.innerHTML = profileInfo.education.map(edu => `
      <div class="info-item">
        <strong>${edu.school}</strong>
        <div>${edu.degree} (${edu.period})</div>
        <div>GPA: ${edu.gpa}</div>
        <div>${edu.focus || ''}</div>
      </div>
    `).join('');
  } else {
    educationInfo.innerHTML = '<div class="info-item">정보 없음</div>';
  }

  // 경력 정보 표시
  const experienceInfo = document.getElementById('experience-info');
  if (profileInfo.experience && profileInfo.experience.length > 0) {
    experienceInfo.innerHTML = profileInfo.experience.map(exp => `
      <div class="info-item">
        <strong>${exp.title}</strong>
        <div>${exp.company} (${exp.period})</div>
        <div>${exp.description || ''}</div>
      </div>
    `).join('');
  } else {
    experienceInfo.innerHTML = '<div class="info-item">정보 없음</div>';
  }

  // 프로젝트 정보 표시
  const projectInfo = document.getElementById('project-info');
  if (profileInfo.projects && profileInfo.projects.length > 0) {
    projectInfo.innerHTML = profileInfo.projects.map(project => `
      <div class="info-item">
        <strong>${project.name}</strong>
        <div>${project.period}</div>
        <div>${project.description || ''}</div>
      </div>
    `).join('');
  } else {
    projectInfo.innerHTML = '<div class="info-item">정보 없음</div>';
  }

  // 자격증 정보 표시
  const certificationInfo = document.getElementById('certification-info');
  if (profileInfo.certifications && profileInfo.certifications.length > 0) {
    certificationInfo.innerHTML = profileInfo.certifications.map(cert => `
      <div class="info-item">
        <strong>${cert.name}</strong>
        <div>${cert.issuer} (${cert.date})</div>
        <div>ID: ${cert.id || '정보 없음'}</div>
      </div>
    `).join('');
  } else {
    certificationInfo.innerHTML = '<div class="info-item">정보 없음</div>';
  }

  // 보유기술 정보 표시
  const skillsInfo = document.getElementById('skills-info');
  if (profileInfo.skills && profileInfo.skills.length > 0) {
    skillsInfo.innerHTML = `<div class="info-item">${profileInfo.skills.join(', ')}</div>`;
  } else {
    skillsInfo.innerHTML = '<div class="info-item">정보 없음</div>';
  }
}

// 커스텀 프로필 폼 숨기기
function hideCustomProfileForm() {
  const form = document.getElementById('custom-profile-form');
  form.classList.add('hidden');
}

// 프로필 정보 데이터
const personaInfo = {
  JS: {
    name: 'JeoungSu',
    age: 32,
    gender: 'M',
    job: 'Developer',
    desc: 'JeoungSu (32M, Developer)\n- 주요 기술: JavaScript, React, Node.js\n- 경력: 8년차 웹 개발자\n- 관심 분야: 프론트엔드, 백엔드, 클라우드'
  },
  SM: {
    name: 'SuMin',
    age: 25,
    gender: 'F',
    job: 'Marketing',
    desc: 'SuMin (25F, Marketing)\n- 주요 기술: 디지털 마케팅, SNS, 콘텐츠 기획\n- 경력: 3년차 마케터\n- 관심 분야: 브랜드 전략, 데이터 분석'
  }
};

function showPersonaInfo(profile) {
  const popup = document.getElementById('profile-info-popup');
  if (!popup) return;
  if (profile === 'JS' || profile === 'SM') {
    popup.textContent = personaInfo[profile].desc;
    popup.classList.remove('hidden');
  } else {
    popup.classList.add('hidden');
  }
}
function hidePersonaInfo() {
  const popup = document.getElementById('profile-info-popup');
  if (popup) popup.classList.add('hidden');
}

// 버튼 클릭 시: 이미 활성화된 상태라면 정보 토글
['use-js-prompt', 'use-sm-prompt'].forEach(btnId => {
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', function() {
    const { promptProfile } = JSON.parse(localStorage.getItem('promptProfile') || '{}') || {};
    const profile = btnId === 'use-js-prompt' ? 'JS' : 'SM';
    const popup = document.getElementById('profile-info-popup');
    // 이미 활성화된 상태라면 정보 토글
    if (btn.classList.contains('active')) {
      if (popup.classList.contains('hidden')) {
        showPersonaInfo(profile);
      } else {
        hidePersonaInfo();
      }
    } else {
      hidePersonaInfo();
    }
  });
  // hover 시 툴팁처럼 표시
  btn.addEventListener('mouseenter', function() {
    if (btn.classList.contains('active')) {
      showPersonaInfo(btnId === 'use-js-prompt' ? 'JS' : 'SM');
    }
  });
  btn.addEventListener('mouseleave', function() {
    hidePersonaInfo();
  });
}); 